import type { Page } from '@playwright/test';
import { agreeToHouseRules, closeRules, expect, inHouseRules, openHouseRules, setHouseRules, test } from './fixtures.ts';

// The lobby flow of the house rules, played in Farkle, the first game with rules. Seat 1 (Alice) is the host.
// The rules live in the Rules dialog's House rules tab, so each check opens it first.

const panel = (page: Page) => page.locator('.house-rules-panel');
const targetField = (page: Page) => page.getByLabel('Target score', { exact: true });
const row = (page: Page, name: string) => page.locator('.house-rules-list li', { hasText: `${name}:` });
const rollButton = (page: Page) => page.getByRole('button', { name: 'Roll', exact: true });
const rulesButton = (page: Page) => page.locator('.game-header').getByRole('button', { name: 'Rules', exact: true });

test.describe('House rules lobby', () => {
  test('the host edits the form and everyone else sees it read-only, live', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('farkle', ['Alice', 'Bob'], { agree: false });
    await expect(panel(alice)).toHaveCount(0); // nothing on the game screen, only in the tab
    await openHouseRules(alice);
    await openHouseRules(bob);
    await expect(panel(alice)).toContainText('You set the house rules');
    await expect(panel(bob)).toContainText('Alice sets the house rules');
    await expect(targetField(alice)).toBeEnabled();
    await expect(targetField(bob)).toBeDisabled();
    // Most players is shown straight away, at the normal maximum, with no checkbox in front of it
    for (const page of [alice, bob]) await expect(panel(page)).not.toContainText("I know what I'm doing");
    await expect(bob.getByLabel('Most players')).toHaveValue('8');
    await expect(bob.getByLabel('Most players')).toBeDisabled();
    await expect(panel(bob)).not.toContainText('(house rule)');
    await closeRules(alice);
    await setHouseRules(alice, 'farkle', { targetScore: 15000 });
    await expect(targetField(bob)).toHaveValue('15000');
    await setHouseRules(alice, 'farkle', {}, 9);
    await expect(bob.getByLabel('Most players')).toHaveValue('9');
    await expect(panel(bob)).toContainText('Most players: 9 (house rule)');
    // Back at the normal maximum it is no longer a house rule
    await setHouseRules(alice, 'farkle', {}, 8);
    await expect(bob.getByLabel('Most players')).toHaveValue('8');
    await expect(panel(bob)).not.toContainText('(house rule)');
  });

  test('the game screen is dimmed until every player agreed', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('farkle', ['Alice', 'Bob'], { agree: false });
    const root = (page: Page) => page.locator('.game-root');
    await expect(root(bob)).toHaveAttribute('data-awaiting-agreement', '');
    await expect(bob.locator('.game-header')).toHaveCSS('opacity', '1');
    await agreeToHouseRules(alice);
    await expect(root(bob)).toHaveAttribute('data-awaiting-agreement', '');
    await agreeToHouseRules(bob);
    for (const page of [alice, bob]) await expect(root(page)).not.toHaveAttribute('data-awaiting-agreement');
  });

  test('Rules is marked while this player still has to agree, and opens on House rules', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('farkle', ['Alice', 'Bob'], { agree: false });
    for (const page of [alice, bob]) await expect(rulesButton(page)).not.toHaveAttribute('data-attention');
    await setHouseRules(alice, 'farkle', { targetScore: 5000 });
    for (const page of [alice, bob]) {
      await expect(rulesButton(page)).toHaveAttribute('data-attention', '');
      await expect(rulesButton(page)).toHaveAccessibleDescription('House rules need your agreement');
    }
    await rulesButton(bob).click();
    await expect(bob.getByRole('button', { name: 'House rules', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await bob.getByRole('button', { name: 'Agree', exact: true }).click();
    await expect(rulesButton(bob)).not.toHaveAttribute('data-attention');
    await expect(rulesButton(alice)).toHaveAttribute('data-attention', '');
    await closeRules(bob);
    // Without a mark, Rules opens on the rules themselves
    await rulesButton(bob).click();
    await expect(bob.getByRole('button', { name: 'Rules', exact: true, pressed: true })).toBeVisible();
  });

  test('nobody can roll until every player agreed', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('farkle', ['Alice', 'Bob'], { agree: false });
    await agreeToHouseRules(alice);
    await inHouseRules(bob, async () => {
      await expect(row(bob, 'Alice')).toHaveText('Alice: agreed');
      await expect(row(bob, 'Bob')).toHaveText('Bob: waiting');
    });
    await rollButton(alice).click();
    await inHouseRules(alice, dialog => expect(dialog).toContainText('Everyone must agree to the house rules first'));
    await agreeToHouseRules(bob);
    await rollButton(alice).click();
    await expect(alice.locator('.farkle-dice .dice-die')).toHaveCount(6);
    // Once play starts the tab is the read-only list
    const dialog = await openHouseRules(alice);
    await expect(dialog.getByRole('region', { name: 'House rules' })).toContainText('Target score');
    await expect(panel(alice)).toHaveCount(0);
  });

  test('a change by the host clears every agreement', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('farkle', ['Alice', 'Bob'], { agree: false });
    await agreeToHouseRules(alice, bob);
    await setHouseRules(alice, 'farkle', { targetScore: 5000 });
    await openHouseRules(bob);
    await expect(row(bob, 'Alice')).toHaveText('Alice: waiting');
    await expect(row(bob, 'Bob')).toHaveText('Bob: waiting');
    await expect(bob.getByRole('button', { name: 'Agree', exact: true })).toBeVisible();
  });

  test('a player joining clears every agreement', async ({ seat }) => {
    const table = await seat('farkle', ['Alice', 'Bob'], { agree: false });
    const [alice, bob] = table.pages;
    await agreeToHouseRules(alice, bob);
    const cara = await table.join('Cara');
    await openHouseRules(alice);
    await expect(row(alice, 'Alice')).toHaveText('Alice: waiting');
    await expect(row(alice, 'Bob')).toHaveText('Bob: waiting');
    await expect(row(alice, 'Cara')).toHaveText('Cara: waiting');
    await expect((await openHouseRules(cara)).getByRole('button', { name: 'Agree', exact: true })).toBeVisible();
  });

  test('the host leaving passes the form to the next player with the choices kept', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await seat('farkle', ['Alice', 'Bob', 'Cara'], { agree: false, houseRules: { targetScore: 20000 } });
    await alice.context().close(); // before the first roll a player who leaves is removed at once, so no dismiss vote
    await openHouseRules(bob);
    await openHouseRules(cara);
    await expect(panel(bob)).toContainText('You set the house rules');
    await expect(panel(cara)).toContainText('Bob sets the house rules');
    await expect(targetField(bob)).toHaveValue('20000');
    await expect(targetField(bob)).toBeEnabled();
    await expect(targetField(cara)).toHaveValue('20000');
  });

  test('raising Most players lets more players join, and it cannot go below the players seated', async ({ seat }) => {
    const names = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
    const table = await seat('farkle', names, { agree: false });
    const [host] = table.pages;
    await expect(table.join('P9')).rejects.toThrow(); // the table is full
    await setHouseRules(host, 'farkle', {}, 10);
    const ninth = await table.join('P9');
    await inHouseRules(ninth, () => expect(row(ninth, 'P9')).toHaveText('P9: waiting'));
    await openHouseRules(host);
    await expect(row(host, 'P9')).toBeVisible();
    // Below the seated count the field puts the seated count back
    const field = host.getByLabel('Most players');
    await field.fill('5');
    await field.press('Enter');
    await expect(field).toHaveValue('10');
  });

  test('the House rules tab shows the chosen rules all game, the house rule marked, and Settings has none', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('farkle', ['Alice', 'Bob'], { houseRules: { targetScore: 5000 }, maxPlayers: 9 });
    await expect(alice.locator('.game-header').getByRole('button', { name: 'House rules', exact: true })).toHaveCount(0);
    await rollButton(alice).click();
    for (const page of [alice, bob]) {
      await inHouseRules(page, async dialog => {
        const summary = dialog.getByRole('region', { name: 'House rules' });
        await expect(summary).toContainText('Target score5,000 (house rule)');
        await expect(summary).toContainText('Most players9 (house rule)');
      });
    }
    await bob.reload();
    await inHouseRules(bob, dialog => expect(dialog).toContainText('Target score5,000 (house rule)'));
    await bob.getByRole('button', { name: 'Settings' }).click();
    const settings = bob.getByRole('dialog', { name: 'Settings' });
    await expect(settings.getByRole('heading', { name: 'Sounds' })).toBeVisible();
    await expect(settings.getByRole('region', { name: 'House rules' })).toHaveCount(0);
  });

  test('a game without rules of its own lists only the Turn timer once play starts', async ({ seat }) => {
    const table = await seat('connectfour', ['Alice', 'Bob']);
    await table.patch({ started: true });
    const rules = (await openHouseRules(table.pages[0])).getByRole('region', { name: 'House rules' });
    await expect(rules).toContainText('Turn timer');
    await expect(rules).not.toContainText('(house rule)');
  });
});

// A rule offered only with another rule's value: turning the parent back must drop the dependent rule, not fail
test.describe('Changing a rule back', () => {
  test('the chess clock turns back off, and the increment goes with it', async ({ seat }) => {
    const { pages: [alice, bob] } = await seat('chess', ['Alice', 'Bob'], { agree: false });
    const clock = (page: Page) => page.getByLabel('Clock', { exact: true });
    const increment = (page: Page) => page.getByLabel('Increment per move', { exact: true });
    await openHouseRules(bob);
    await setHouseRules(alice, 'chess', { clockMinutes: 5, incrementSeconds: 2 });
    await expect(increment(bob)).toHaveValue('2');
    await setHouseRules(alice, 'chess', { clockMinutes: 'off' });
    await expect(clock(bob)).toHaveValue('off');
    await expect(increment(bob)).toHaveCount(0);
    await inHouseRules(alice, async dialog => {
      await expect(clock(alice)).toHaveValue('off');
      await expect(increment(alice)).toHaveCount(0);
      await expect(dialog.locator('.house-rules-error')).toHaveCount(0);
    });
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
    for (const page of pages) await inHouseRules(page, dialog => expect(dialog.locator('.house-rules-list li')).toHaveCount(6));
    await openHouseRules(bob);
    await setHouseRules(alice, 'rook', { sixTeams: 'threeOfTwo', defenders: 'together' });
    await expect(defenders(bob)).toHaveValue('together');
    await setHouseRules(alice, 'rook', { sixTeams: 'twoOfThree' });
    await expect(teams(bob)).toHaveValue('twoOfThree');
    await expect(defenders(bob)).toHaveCount(0);
    await inHouseRules(alice, async dialog => {
      await expect(teams(alice)).toHaveValue('twoOfThree');
      await expect(dialog.locator('.house-rules-error')).toHaveCount(0);
    });
    await setHouseRules(alice, 'rook', { sixTeams: 'threeOfTwo' });
    await expect(defenders(bob)).toHaveValue('separate');
  });
});
