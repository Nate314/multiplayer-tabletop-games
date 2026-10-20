import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, test, undo, type Seat } from './fixtures.ts';
import type { GameState } from '../games/racko/types.ts';

// One test per rule, control and difference in games/racko/README.md. Seat 1 is Alice, 2 Bob, 3 Cara.

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
// Alice's rack is 1 to 10 with a 50 in slot 5; the discard top is 5 and the draw pile ends in 40
const NEARLY = { racks: { 1: [1, 2, 3, 4, 50, 6, 7, 8, 9, 10], 2: range(11, 20) }, drawPile: [60, 40], discardPile: [30, 5] };

async function start(seat: Seat, names = ['Alice', 'Bob'], fields: object = NEARLY) {
  const table = await seat('racko', names);
  if (Object.keys(fields).length > 0) await table.patch({ scores: Object.fromEntries(names.map((_, index) => [index + 1, 0])), ...fields });
  return { table, pages: table.pages, alice: table.pages[0], bob: table.pages[1] };
}

const drawPile = (page: Page) => page.getByRole('button', { name: /^Draw pile/ });
const discardPile = (page: Page) => page.getByRole('button', { name: /^Discard pile, top card/ });
const slot = (page: Page, number: number) => page.getByRole('button', { name: new RegExp(`^Place in slot ${number},`) });
const discardButton = (page: Page) => page.getByRole('button', { name: 'Discard', exact: true });
const status = (page: Page) => page.locator('.game-status');
const scoring = (page: Page) => page.getByRole('dialog', { name: 'Round scoring' });
const myRack = (page: Page) => page.getByRole('region', { name: 'Your rack' });

test.describe('Rack-O rules', () => {
  test('the deck is 40, 50 or 60 cards for two, three or four players, ten to each rack, one card face up', async ({ seat }) => {
    for (const names of [['Alice', 'Bob'], ['Alice', 'Bob', 'Cara'], ['Alice', 'Bob', 'Cara', 'Dan']]) {
      const { table, alice } = await start(seat, names, {});
      const state = await table.state<GameState>();
      const all = [...Object.values(state.racks).flat(), ...state.drawPile, ...state.discardPile].sort((a, b) => a - b);
      expect(all).toEqual(range(1, 20 + 10 * (names.length - 2) + 20));
      for (const rack of Object.values(state.racks)) expect(rack).toHaveLength(10);
      expect(state.discardPile).toHaveLength(1);
      await expect(myRack(alice).locator('.tile')).toHaveCount(10);
      await expect(discardPile(alice)).toHaveAccessibleName(`Discard pile, top card ${state.discardPile[0]}`);
    }
  });

  test('you see your own rack in slot order and the others only face down', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(slot(alice, 1)).toHaveCount(0);
    await expect(myRack(alice).getByLabel(/^Slot 5, card 50$/)).toBeVisible();
    await expect(myRack(bob).getByLabel(/^Slot 1, card 11$/)).toBeVisible();
    await expect(alice.getByRole('region', { name: "Bob's rack" }).getByLabel('Face-down card')).toHaveCount(10);
    expect(await alice.locator('body').innerText()).not.toMatch(/\b(1[1-9]|20)\b/);
  });

  test('a turn takes the draw pile or the discard pile, and a rack card goes to the discard pile when replaced', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await drawPile(alice).click();
    await expect(status(bob)).toHaveText('Alice drew from the draw pile');
    await slot(alice, 2).click();
    await expect(status(bob)).toHaveText('Alice put the card from the draw pile in slot 2 and discarded the 2');
    await expect(discardPile(bob)).toHaveAccessibleName('Discard pile, top card 2');
    await expect(bob.locator('.turn-message')).toHaveText('Your turn');
    await discardPile(bob).click();
    await expect(status(alice)).toHaveText('Bob took the 2 from the discard pile');
  });

  test('a card from the draw pile may be discarded and only you see it until then', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await drawPile(alice).click();
    await expect(alice.getByLabel('Your card 40')).toBeVisible();
    await expect(bob.getByLabel('Your card 40')).toHaveCount(0);
    await expect(bob.getByLabel('A card from the draw pile')).toBeVisible();
    await expect(bob.getByLabel(/40/)).toHaveCount(0);
    await discardButton(alice).click();
    await expect(status(bob)).toHaveText('Alice discarded the 40');
    await expect(discardPile(bob)).toHaveAccessibleName('Discard pile, top card 40');
    await expect(bob.locator('.turn-message')).toHaveText('Your turn');
  });

  test('a card taken from the discard pile must be placed', async ({ seat }) => {
    const { alice } = await start(seat);
    await discardPile(alice).click();
    await expect(alice.getByLabel('Your card 5')).toBeVisible();
    await expect(discardButton(alice)).toHaveCount(0);
    await expect(drawPile(alice)).toBeDisabled();
    await expect(slot(alice, 1)).toBeEnabled();
  });

  test('cards only replace the card in a slot, so the rest of the rack stays where it is', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await discardPile(alice).click();
    await slot(alice, 1).click();
    const state = await table.state<GameState>();
    expect(state.racks[1]).toEqual([5, 2, 3, 4, 50, 6, 7, 8, 9, 10]);
    await expect(myRack(alice).locator('.tile')).toHaveCount(10);
  });

  test('an ascending rack calls Rack-O, scores 75 and shows every rack; the others score 5 a card in order', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await discardPile(alice).click();
    await slot(alice, 5).click();
    for (const page of [alice, bob]) {
      await expect(scoring(page)).toContainText('Round 1 scoring');
      await expect(scoring(page)).toContainText('Alice called Rack-O and scores 75 points');
      await expect(scoring(page).locator('.summary-seat').nth(0)).toContainText('75 pts');
      await expect(scoring(page).locator('.summary-seat').nth(1)).toContainText('50 pts');
      await expect(scoring(page).locator('.summary-seat').nth(1).locator('.tile')).toHaveCount(10);
    }
  });

  test('a partly ordered rack scores 5 for each card in order from slot 1', async ({ seat }) => {
    const { alice, bob } = await start(seat, ['Alice', 'Bob'], { ...NEARLY, racks: { 1: NEARLY.racks[1], 2: [1, 2, 3, 9, 4, 5, 6, 7, 8, 10] } });
    await discardPile(alice).click();
    await slot(alice, 5).click();
    await expect(scoring(bob).locator('.summary-seat').nth(1)).toContainText('20 pts');
  });

  test('Continue waits for every connected player and then deals the next round to the left', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await discardPile(alice).click();
    await slot(alice, 5).click();
    await scoring(alice).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(alice)).toContainText('Waiting for Bob');
    await scoring(bob).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(alice)).toHaveCount(0);
    await expect(status(alice)).toHaveText('Round 2: Bob goes first');
    await expect(bob.locator('.turn-message')).toHaveText('Your turn');
    await expect(alice.getByRole('region', { name: 'Your rack' })).toContainText('75 pts');
  });

  test('Continue does not wait for a disconnected player', async ({ seat }) => {
    const { alice, bob, table } = await start(seat, ['Alice', 'Bob', 'Cara'], {});
    // Leaving before the first move would only remove Cara's seat, so the game starts first
    await drawPile(alice).click();
    await discardButton(alice).click();
    await table.patch({ racks: { ...NEARLY.racks, 3: range(21, 30) }, drawPile: NEARLY.drawPile, discardPile: NEARLY.discardPile, currentPlayer: 1, held: null });
    await leave(table.pages[2]);
    await discardPile(alice).click();
    await slot(alice, 5).click();
    await scoring(alice).getByRole('button', { name: 'Continue' }).click();
    await scoring(bob).getByRole('button', { name: 'Continue' }).click();
    await expect(status(alice)).toHaveText('Round 2: Bob goes first');
  });

  test('an empty draw pile reshuffles the discards but the top card', async ({ seat, }) => {
    const { table, alice, bob } = await start(seat, ['Alice', 'Bob'], { ...NEARLY, drawPile: [], discardPile: [30, 31, 32, 5] });
    await drawPile(alice).click();
    await expect(status(bob)).toHaveText('Alice drew from the draw pile (the discards were reshuffled into it)');
    await expect(discardPile(bob)).toHaveAccessibleName('Discard pile, top card 5');
    const state = await table.state<GameState>();
    expect([state.held?.card, ...state.drawPile].sort()).toEqual([30, 31, 32]);
  });

  test('with only the top card left the draw pile cannot be used', async ({ seat }) => {
    const { alice } = await start(seat, ['Alice', 'Bob'], { ...NEARLY, drawPile: [], discardPile: [5] });
    await expect(drawPile(alice)).toBeDisabled();
    await discardPile(alice).click();
    await expect(alice.getByLabel('Your card 5')).toBeVisible();
  });

  test('the game ends at 500 points, and Close and Show Scoring work', async ({ seat }) => {
    const { alice, bob } = await start(seat, ['Alice', 'Bob'], { ...NEARLY, scores: { 1: 425, 2: 100 } });
    await discardPile(alice).click();
    await slot(alice, 5).click();
    for (const page of [alice, bob]) {
      await expect(scoring(page)).toContainText('Final scoring');
      await expect(scoring(page)).toContainText('Alice called Rack-O! Alice wins with 500 points');
      await expect(scoring(page).getByRole('button', { name: 'Continue' })).toHaveCount(0);
    }
    await scoring(bob).getByRole('button', { name: 'Close' }).click();
    await expect(scoring(bob)).toHaveCount(0);
    await expect(bob.locator('.turn-message')).toHaveText('Game over');
    await bob.getByRole('button', { name: 'Show Scoring' }).click();
    await expect(scoring(bob)).toBeVisible();
  });

  test('when several players pass 500 in one round the higher total wins', async ({ seat }) => {
    const { alice } = await start(seat, ['Alice', 'Bob'], { ...NEARLY, scores: { 1: 100, 2: 460 } });
    await discardPile(alice).click();
    await slot(alice, 5).click();
    await expect(scoring(alice)).toContainText('Bob wins with 510 points');
  });

  test('only the player whose turn it is can pick up a card', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(drawPile(bob)).toBeDisabled();
    await expect(discardPile(bob)).toBeDisabled();
    await expect(drawPile(alice)).toBeEnabled();
  });
});

test.describe('Rack-O controls and platform', () => {
  test('Undo takes back a draw and the draw pile is reshuffled', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await drawPile(alice).click();
    await expect(alice.getByLabel('Your card 40')).toBeVisible();
    await undo(alice, bob);
    await expect(alice.getByLabel(/^Your card/)).toHaveCount(0);
    await expect(alice.locator('.turn-message')).toHaveText('Your turn');
    const state = await table.state<GameState>();
    expect([...state.drawPile].sort((a, b) => a - b)).toEqual([40, 60]);
    expect(state.held).toBeNull();
  });

  test('a refresh mid-turn shows the card you drew', async ({ seat }) => {
    const { alice } = await start(seat);
    await drawPile(alice).click();
    await alice.reload();
    await expect(alice.getByLabel('Your card 40')).toBeVisible();
    await expect(slot(alice, 3)).toBeEnabled();
    await expect(discardButton(alice)).toBeVisible();
  });

  test('a dismissed player\'s rack goes back into the draw pile and the turn moves on', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, ['Alice', 'Bob', 'Cara'], {});
    const cara = table.pages[2];
    await drawPile(alice).click();
    await discardButton(alice).click();
    await drawPile(bob).click();
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(cara.locator('.turn-message')).toHaveText('Your turn');
    const state = await table.state<GameState>();
    expect(state.held).toBeNull();
    expect(state.drawPile.length + state.discardPile.length + 20).toBe(50);
  });

  test('the FAQ answers the rules questions', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('How is a round scored?');
    await expect(faq).toContainText('What if the draw pile runs out?');
  });
});
