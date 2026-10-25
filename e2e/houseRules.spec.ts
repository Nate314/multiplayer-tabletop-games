import type { Page } from '@playwright/test';
import { agreeToHouseRules, expect, setHouseRules, test } from './fixtures.ts';

// The lobby flow of the house rules, played in Farkle, the first game with rules. Seat 1 (Alice) is the host.

const panel = (page: Page) => page.locator('.house-rules-panel');
const targetField = (page: Page) => page.getByLabel('Target score', { exact: true });
const row = (page: Page, name: string) => page.locator('.house-rules-list li', { hasText: `${name}:` });
const rollButton = (page: Page) => page.getByRole('button', { name: 'Roll', exact: true });

test.describe('House rules lobby', () => {
  test('the host edits the form and everyone else sees it read-only, live', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('farkle', ['Alice', 'Bob'], { agree: false });
    await expect(panel(alice)).toContainText('You set the house rules');
    await expect(panel(bob)).toContainText('Alice sets the house rules');
    await expect(targetField(alice)).toBeEnabled();
    await expect(targetField(bob)).toBeDisabled();
    await expect(bob.getByLabel("I know what I'm doing")).toBeDisabled();
    await setHouseRules(alice, 'farkle', { targetScore: 15000 });
    await expect(targetField(bob)).toHaveValue('15000');
    await setHouseRules(alice, 'farkle', {}, 9);
    await expect(bob.getByLabel("I know what I'm doing")).toBeChecked();
    await expect(bob.getByLabel('Most players')).toHaveValue('9');
    await expect(bob.getByLabel('Most players')).toBeDisabled();
  });

  test('nobody can roll until every player agreed', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('farkle', ['Alice', 'Bob'], { agree: false });
    await agreeToHouseRules(alice);
    await expect(row(bob, 'Alice')).toHaveText('Alice: agreed');
    await expect(row(bob, 'Bob')).toHaveText('Bob: waiting');
    await rollButton(alice).click();
    await expect(panel(alice)).toContainText('Everyone must agree to the house rules first');
    await agreeToHouseRules(bob);
    await rollButton(alice).click();
    await expect(panel(alice)).toHaveCount(0);
    await expect(alice.locator('.farkle-dice .dice-die')).toHaveCount(6);
  });

  test('a change by the host clears every agreement', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('farkle', ['Alice', 'Bob'], { agree: false });
    await agreeToHouseRules(alice, bob);
    await setHouseRules(alice, 'farkle', { targetScore: 5000 });
    await expect(row(bob, 'Alice')).toHaveText('Alice: waiting');
    await expect(row(bob, 'Bob')).toHaveText('Bob: waiting');
    await expect(bob.getByRole('button', { name: 'Agree', exact: true })).toBeVisible();
  });

  test('a player joining clears every agreement', async ({ seat }) => {
    const table = await seat('farkle', ['Alice', 'Bob'], { agree: false });
    const [alice, bob] = table.pages;
    await agreeToHouseRules(alice, bob);
    const cara = await table.join('Cara');
    await expect(row(alice, 'Alice')).toHaveText('Alice: waiting');
    await expect(row(alice, 'Bob')).toHaveText('Bob: waiting');
    await expect(row(alice, 'Cara')).toHaveText('Cara: waiting');
    await expect(cara.getByRole('button', { name: 'Agree', exact: true })).toBeVisible();
  });

  test('the host leaving passes the form to the next player with the choices kept', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await seat('farkle', ['Alice', 'Bob', 'Cara'], { agree: false, houseRules: { targetScore: 20000 } });
    await alice.context().close(); // before the first roll a player who leaves is removed at once, so no dismiss vote
    await expect(panel(bob)).toContainText('You set the house rules');
    await expect(panel(cara)).toContainText('Bob sets the house rules');
    await expect(targetField(bob)).toHaveValue('20000');
    await expect(targetField(bob)).toBeEnabled();
    await expect(targetField(cara)).toHaveValue('20000');
  });

  test('the override lets more players join, and cannot go below the players seated', async ({ seat }) => {
    const names = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
    const table = await seat('farkle', names, { agree: false });
    const [host] = table.pages;
    await expect(table.join('P9')).rejects.toThrow(); // the table is full
    await setHouseRules(host, 'farkle', {}, 10);
    const ninth = await table.join('P9');
    await expect(row(ninth, 'P9')).toHaveText('P9: waiting');
    await expect(row(host, 'P9')).toBeVisible();
    // Below the seated count the field puts the seated count back
    const field = host.getByLabel('Most players');
    await field.fill('5');
    await field.press('Enter');
    await expect(field).toHaveValue('10');
  });

  test('the House rules dialog shows the chosen rules all game, the house rule marked', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('farkle', ['Alice', 'Bob'], { houseRules: { targetScore: 5000 }, maxPlayers: 6 });
    const dialog = (page: Page) => page.getByRole('dialog', { name: 'House rules' });
    await rollButton(alice).click();
    await expect(panel(bob)).toHaveCount(0);
    for (const page of [alice, bob]) {
      await page.getByRole('button', { name: 'House rules', exact: true }).click();
      await expect(dialog(page)).toContainText('Target score5,000 (house rule)');
      await expect(dialog(page)).toContainText('Most players6 (house rule)');
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toHaveCount(0);
    }
    await bob.reload();
    await bob.getByRole('button', { name: 'House rules', exact: true }).click();
    await expect(dialog(bob)).toContainText('Target score5,000 (house rule)');
  });
});

// A rule offered only with another rule's value: turning the parent back must drop the dependent rule, not fail
test.describe('Changing a rule back', () => {
  test('the chess clock turns back off, and the increment goes with it', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('chess', ['Alice', 'Bob'], { agree: false });
    const clock = (page: Page) => page.getByLabel('Clock', { exact: true });
    const increment = (page: Page) => page.getByLabel('Increment per move', { exact: true });
    await setHouseRules(alice, 'chess', { clockMinutes: 5, incrementSeconds: 2 });
    await expect(increment(bob)).toHaveValue('2');
    await setHouseRules(alice, 'chess', { clockMinutes: 'off' });
    for (const page of [alice, bob]) {
      await expect(clock(page)).toHaveValue('off');
      await expect(increment(page)).toHaveCount(0);
    }
    await expect(alice.locator('.house-rules-error')).toHaveCount(0);
    await alice.getByRole('button', { name: 'House rules', exact: true }).click();
    const dialog = alice.getByRole('dialog', { name: 'House rules' });
    await expect(dialog).toContainText('ClockOff');
    await expect(dialog).not.toContainText('Increment per move');
    await alice.keyboard.press('Escape');
    await setHouseRules(alice, 'chess', { clockMinutes: 10 });
    await expect(increment(bob)).toHaveValue('0');
    await expect(clock(bob)).toHaveValue('10');
  });

  test('Rook at six goes from three teams of two back to two teams of three', async ({ seat }) => {
    const names = ['Alice', 'Bob', 'Cara', 'Dan', 'Eve', 'Fay'];
    const { pages } = await seat('rook', names, { maxPlayers: 6, agree: false });
    const [alice, bob] = pages;
    const teams = (page: Page) => page.getByLabel('Teams at 6 players', { exact: true });
    const defenders = (page: Page) => page.getByLabel('Defending teams score', { exact: true });
    for (const page of pages) await expect(page.locator('.house-rules-list li')).toHaveCount(6);
    await setHouseRules(alice, 'rook', { sixTeams: 'threeOfTwo', defenders: 'together' });
    await expect(defenders(bob)).toHaveValue('together');
    await setHouseRules(alice, 'rook', { sixTeams: 'twoOfThree' });
    for (const page of [alice, bob]) {
      await expect(teams(page)).toHaveValue('twoOfThree');
      await expect(defenders(page)).toHaveCount(0);
    }
    await expect(alice.locator('.house-rules-error')).toHaveCount(0);
    await setHouseRules(alice, 'rook', { sixTeams: 'threeOfTwo' });
    await expect(defenders(bob)).toHaveValue('separate');
  });
});
