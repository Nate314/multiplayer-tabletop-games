import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, setPreference, test, undo, type Seat as SeatFixture, type SeatOptions, type Table } from './fixtures.ts';
import { createDeck } from '../games/phase10/rules.ts';
import type { Card, CardColor, GameState, Group } from '../games/phase10/types.ts';

// One test per rule and control in games/phase10/README.md. Seat 1 (Alice) goes first unless the opening discard is a
// Skip. Most tests deal crafted hands; every card not in a hand, a group or the discard pile goes to the draw pile.

const NAMES = ['Alice', 'Bob', 'Cara'];
const COLORS: CardColor[] = ['red', 'blue', 'green', 'yellow'];

async function start(seat: SeatFixture, players = 2, options?: SeatOptions) {
  const table = await seat('phase10', NAMES.slice(0, players), options);
  return { table, pages: table.pages, alice: table.pages[0], bob: table.pages[1] };
}

// The deck's own card for a number, color and copy (each number card comes twice)
const n = (value: number, color: CardColor, copy = 0): Card => ({ id: copy * 48 + COLORS.indexOf(color) * 12 + value - 1, kind: 'number', value, color });
const wild = (index: number): Card => ({ id: 96 + index, kind: 'wild' });
const skip = (index: number): Card => ({ id: 104 + index, kind: 'skip' });
const setOf = (owner: number, value: number, cards: Card[]): Group => ({ owner, kind: 'set', value, cards });

type Deal = Partial<GameState> & { hands: GameState['hands']; drawTop?: Card[] };

// Crafts the hand: `drawTop` is drawn first (its last card on top), the discard pile defaults to one green 1,
// and the rest of the deck makes the draw pile. It is Alice's turn, with nothing drawn yet.
async function deal(table: Table, { drawTop = [], discardPile = [n(1, 'green', 1)], groups = [], ...fields }: Deal) {
  const used = new Set([...Object.values(fields.hands).flat(), ...drawTop, ...discardPile, ...groups.flatMap(group => group.cards)].map(card => card.id));
  const drawPile = [...createDeck().filter(card => !used.has(card.id)), ...drawTop];
  await table.patch({ currentPlayer: 1, drawnBy: null, groups, discardPile, drawPile, ...fields });
}

const handRegion = (page: Page) => page.getByRole('region', { name: 'Your hand' });
const handCards = (page: Page) => handRegion(page).locator('.hand-cards');
const handLabels = (page: Page) => handCards(page).locator('.card').evaluateAll(cards => cards.map(card => card.getAttribute('aria-label')));
// Selects one more card of each name, so two Wilds are two clicks on different cards
async function select(page: Page, ...names: string[]) {
  for (const name of names) await handCards(page).getByRole('button', { name, exact: true, pressed: false }).first().click();
}
const drawPile = (page: Page) => page.locator('.piles .pile').nth(0);
const discardPile = (page: Page) => page.locator('.piles .pile').nth(1);
const seatOf = (page: Page, name: string) => page.locator('.table .seat').filter({ has: page.locator('.seat-name', { hasText: name }) });
const group = (page: Page, label: string) => page.locator('.table .group').filter({ has: page.locator('.group-label', { hasText: label }) });
const turnMessage = (page: Page) => page.locator('.turn-message');
const scoring = (page: Page) => page.getByRole('dialog', { name: 'Hand scoring' });
const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });
const summaryOf = (page: Page, name: string) => scoring(page).locator('.summary-seat', { has: page.locator('.summary-name', { hasText: name }) });

async function stage(page: Page, part: number, ...names: string[]) {
  await select(page, ...names);
  await button(page, `Add selected to group ${part}`).click();
}

async function discard(page: Page, name: string) {
  await select(page, name);
  await button(page, 'Discard selected card').click();
}

// Phase 1 laid down by `owner`: a set of 5s and a set of 7s
const phaseOne = (owner: number, copy = 0): Group[] => [
  setOf(owner, 5, [n(5, 'red', copy), n(5, 'blue', copy), n(5, 'green', copy)]),
  setOf(owner, 7, [n(7, 'red', copy), n(7, 'blue', copy), n(7, 'green', copy)])
];

// Random numbers that leave the next shuffled deck in its fresh order, so the next hand never opens with a Skip
const UNSHUFFLED = Array.from({ length: 107 }, (_, step) => (107 - step + 0.5) / (108 - step));

const tenCards = (color: CardColor, copy = 0) => Array.from({ length: 10 }, (_, index) => n(index + 1, color, copy));

test.describe('Phase 10 rules', () => {
  test('108 cards: 1 to 12 in four colors twice each, 8 Wilds and 4 Skips; 10 cards each and one starts the discard pile', async ({ seat }) => {
    const { table, alice } = await start(seat);
    const state = await table.state<GameState>();
    const cards = [...Object.values(state.hands).flat(), ...state.drawPile, ...state.discardPile];
    expect(cards).toHaveLength(108);
    expect(cards.filter(card => card.kind === 'wild')).toHaveLength(8);
    expect(cards.filter(card => card.kind === 'skip')).toHaveLength(4);
    for (const color of COLORS) {
      for (let value = 1; value <= 12; value++) {
        expect(cards.filter(card => card.kind === 'number' && card.color === color && card.value === value)).toHaveLength(2);
      }
    }
    expect(state.discardPile).toHaveLength(1);
    await expect(handRegion(alice)).toContainText('Your hand (10)');
    await expect(seatOf(alice, 'Bob')).toContainText('10 cards');
    await expect(drawPile(alice)).toContainText('Draw pile (87)');
    await expect(discardPile(alice).locator('.card')).toHaveCount(1);
  });

  test('the ten phases come in order, from 2 sets of 3 to 1 set of 5 + 1 set of 3', async ({ seat }) => {
    const { table, alice } = await start(seat);
    const names = [
      '2 sets of 3', '1 set of 3 + 1 run of 4', '1 set of 4 + 1 run of 4', '1 run of 7', '1 run of 8',
      '1 run of 9', '2 sets of 4', '7 cards of one color', '1 set of 5 + 1 set of 2', '1 set of 5 + 1 set of 3'
    ];
    await expect(seatOf(alice, 'Alice')).toContainText(`Phase 1: ${names[0]}`);
    for (const [index, name] of names.entries()) {
      await table.patch({ phases: { 1: index + 1, 2: 1 } });
      await expect(seatOf(alice, 'Alice')).toContainText(`Phase ${index + 1}: ${name}`);
    }
  });

  test('a turn starts with a draw from the pile or the discard top, and a Skip cannot be picked up', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await deal(table, {
      hands: { 1: tenCards('red'), 2: [skip(0), ...tenCards('blue').slice(1)] },
      drawTop: [n(9, 'green')],
      discardPile: [n(4, 'yellow'), n(6, 'yellow')]
    });
    await expect(drawPile(alice)).toContainText('Draw pile (86)');
    await drawPile(alice).click();
    await expect(handRegion(alice)).toContainText('Your hand (11)');
    await expect(handCards(alice).getByRole('button', { name: 'green 9' })).toHaveCount(1);
    await expect(drawPile(alice)).toContainText('Draw pile (85)');
    await expect(drawPile(alice)).toBeDisabled(); // one draw a turn
    await discard(alice, 'green 9');

    await expect(discardPile(bob).locator('.card')).toHaveAttribute('aria-label', 'green 9');
    await discardPile(bob).click();
    await expect(handCards(bob).getByRole('button', { name: 'green 9' })).toHaveCount(1);
    await expect(discardPile(bob).locator('.card')).toHaveAttribute('aria-label', 'yellow 6');
    await select(bob, 'Skip');
    await button(bob, 'Discard Skip on Alice').click(); // Alice loses her turn, so it is Bob's again

    await expect(turnMessage(bob)).toHaveText("Hand 1: Bob's turn");
    await expect(discardPile(bob).locator('.card')).toHaveAttribute('aria-label', 'Skip');
    await expect(discardPile(bob)).toBeDisabled();
    await expect(drawPile(bob)).toBeEnabled();
  });

  test('you may lay down your phase once per hand, using exactly the cards it asks for', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await deal(table, {
      hands: {
        1: [n(5, 'red'), n(5, 'blue'), n(5, 'green'), n(7, 'red'), n(7, 'blue'), n(7, 'green'), n(7, 'yellow'), n(2, 'red'), n(3, 'red'), n(9, 'blue')],
        2: tenCards('yellow', 1)
      },
      drawTop: [n(11, 'blue')]
    });
    await drawPile(alice).click();
    await stage(alice, 1, 'red 5', 'blue 5', 'green 5', 'yellow 7');
    await stage(alice, 2, 'red 7', 'blue 7', 'green 7');
    await expect(alice.locator('.lay-down')).toContainText('Group 1: a set of 3 (4/3)');
    await expect(button(alice, 'Lay down phase')).toBeDisabled(); // four cards where the phase asks for three
    await alice.locator('.lay-down').getByRole('button', { name: 'yellow 7' }).click();
    await expect(alice.locator('.lay-down')).toContainText('Group 1: a set of 3 (3/3)');
    await button(alice, 'Lay down phase').click();

    await expect(group(alice, 'Set of 5s').locator('.card')).toHaveCount(3);
    await expect(group(alice, 'Set of 7s').locator('.card')).toHaveCount(3);
    await expect(handRegion(alice)).toContainText('Your hand (5)');
    await expect(alice.locator('.lay-down')).toHaveCount(0); // no second phase this hand
  });

  test('once your phase is down you may hit on any group, and a discard ends your turn', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await deal(table, {
      hands: { 1: [n(5, 'yellow'), n(9, 'blue'), n(2, 'red')], 2: tenCards('yellow', 1).slice(0, 8) },
      groups: [setOf(2, 9, [n(9, 'red'), n(9, 'green'), n(9, 'yellow')]), setOf(2, 10, [n(10, 'red'), n(10, 'green'), n(10, 'yellow')])],
      drawTop: [n(12, 'green')]
    });
    // Before Alice's phase is down there is nothing to hit with
    await drawPile(alice).click();
    await select(alice, 'blue 9');
    await expect(alice.locator('.hit-button')).toHaveCount(0);
    await handCards(alice).getByRole('button', { name: 'blue 9' }).click(); // deselect while the phase is laid down for her
    await table.patch({ groups: [...(await table.state<GameState>()).groups, ...phaseOne(1)] });
    await expect(seatOf(alice, 'Alice').locator('.group')).toHaveCount(2);
    await select(alice, 'blue 9');

    await expect(alice.locator('.hit-button')).toHaveCount(4);
    await group(alice, 'Set of 9s').getByRole('button', { name: 'Hit here' }).click(); // Bob's group
    await expect(group(bob, 'Set of 9s').locator('.card')).toHaveCount(4);
    await select(alice, 'yellow 5');
    await group(alice, 'Set of 5s').getByRole('button', { name: 'Hit here' }).click();
    await expect(group(bob, 'Set of 5s').locator('.card')).toHaveCount(4);
    await expect(turnMessage(bob)).toHaveText("Hand 1: Alice's turn"); // hitting does not end the turn

    await discard(alice, 'red 2');
    await expect(turnMessage(bob)).toHaveText("Hand 1: Bob's turn");
    await expect(discardPile(bob).locator('.card')).toHaveAttribute('aria-label', 'red 2');
  });

  test('a Wild stands for any card but every group needs a real number', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await deal(table, {
      hands: { 1: [wild(0), wild(1), wild(2), wild(3), n(8, 'red'), n(8, 'blue'), n(3, 'red'), n(3, 'blue'), n(11, 'green'), n(12, 'yellow')], 2: tenCards('yellow', 1) },
      groups: [{ owner: 2, kind: 'run', start: 4, cards: [n(4, 'red', 1), wild(4), n(6, 'red', 1), n(7, 'red', 1)] }]
    });
    await expect(group(alice, 'Run 4 to 7').locator('.card-wild .card-stands-for')).toHaveText('5');
    await drawPile(alice).click();
    await stage(alice, 1, 'Wild', 'Wild', 'Wild');
    await stage(alice, 2, 'red 8', 'blue 8', 'Wild');
    await expect(button(alice, 'Lay down phase')).toBeDisabled(); // group 1 has no number card
    await button(alice, 'Clear').click();
    await stage(alice, 1, 'red 8', 'blue 8', 'Wild');
    await stage(alice, 2, 'red 3', 'Wild', 'Wild');
    await button(alice, 'Lay down phase').click();
    await expect(group(alice, 'Set of 8s').locator('.card-wild')).toHaveCount(1);
    await expect(group(alice, 'Set of 3s').locator('.card-wild')).toHaveCount(2);
  });

  test('discarding a Skip makes the player you choose lose their next turn', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, 3);
    await deal(table, { hands: { 1: [skip(0), ...tenCards('red').slice(1)], 2: tenCards('blue'), 3: tenCards('green') } });
    await drawPile(alice).click();
    await select(alice, 'Skip');
    await expect(button(alice, 'Discard Skip on Bob')).toBeVisible();
    await button(alice, 'Discard Skip on Cara').click();
    await expect(seatOf(bob, 'Cara')).toContainText('skipped next');
    await expect(turnMessage(cara)).toHaveText("Hand 1: Bob's turn");
    await drawPile(bob).click();
    await discard(bob, 'blue 1');
    await expect(turnMessage(cara)).toHaveText("Hand 1: Alice's turn"); // Cara's turn was skipped
    await expect(seatOf(bob, 'Cara')).not.toContainText('skipped next');
  });

  test('a Skip turned up to start the discard pile skips the first player', async ({ seat }) => {
    const first = await seat('phase10', ['Alice']);
    // The deal shuffles the deck when Bob joins: from the last position down, swap with a chosen one. Keep every card
    // in place but move the first Skip (position 104) to position 20, the card that starts the discard pile.
    const values: number[] = [];
    for (let position = 107; position >= 20; position--) {
      const swapWith = position === 104 ? 20 : position;
      values.push((swapWith + 0.5) / (position + 1));
    }
    await first.random(...values);
    const bob = await first.join('Bob');
    const alice = first.pages[0];
    await expect(discardPile(alice).locator('.card')).toHaveAttribute('aria-label', 'Skip');
    await expect(alice.locator('.game-status')).toContainText('The first discard is a Skip, so Alice is skipped.');
    await expect(turnMessage(alice)).toHaveText('Bob goes first. Joining closes after the first move.');
    await expect(drawPile(alice)).toBeDisabled();
    await expect(drawPile(bob)).toBeEnabled();
    await expect(discardPile(bob)).toBeDisabled();
  });

  test('a hand ends when a player discards their last card; the rest score their cards and finished phases move on', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await deal(table, {
      hands: { 1: [n(3, 'red')], 2: [n(2, 'red'), n(11, 'red'), skip(0), wild(0)] },
      groups: phaseOne(1),
      drawTop: [n(5, 'yellow')]
    });
    await expect(seatOf(alice, 'Bob')).toContainText('dealer');
    await drawPile(alice).click();
    await select(alice, 'yellow 5');
    await group(alice, 'Set of 5s').getByRole('button', { name: 'Hit here' }).click();
    await discard(alice, 'red 3');

    const dialog = scoring(bob);
    await expect(dialog.getByRole('heading')).toHaveText('Hand 1 scoring');
    await expect(dialog.locator('.summary-result')).toHaveText('Alice went out');
    await expect(summaryOf(bob, 'Alice')).toContainText('Phase 1 done');
    await expect(summaryOf(bob, 'Alice')).toContainText('0 cards left: +0');
    await expect(summaryOf(bob, 'Bob')).toContainText('Phase 1 not done');
    await expect(summaryOf(bob, 'Bob')).toContainText('4 cards left: +55'); // 5 + 10 + 15 + 25
    await expect(summaryOf(bob, 'Bob').locator('.summary-points')).toHaveText('55 pts');

    await scoring(alice).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(alice)).toContainText('Waiting for Bob');
    await expect(turnMessage(alice)).toHaveText('Hand 1 is over');
    await table.random(...UNSHUFFLED);
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(alice)).toHaveCount(0);
    // The deal moved from Bob to Alice, so Bob starts
    await expect(turnMessage(alice)).toHaveText("Hand 2: Bob's turn");
    await expect(seatOf(alice, 'Alice')).toContainText('dealer');
    await expect(seatOf(alice, 'Alice')).toContainText('Phase 2: 1 set of 3 + 1 run of 4');
    await expect(seatOf(alice, 'Bob')).toContainText('Phase 1: 2 sets of 3');
    await expect(seatOf(alice, 'Bob')).toContainText('55 pts');
    await expect(handRegion(alice)).toContainText('Your hand (10)');
  });

  test('a hand also ends when a player hits their last card', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await deal(table, { hands: { 1: [n(5, 'yellow')], 2: [n(1, 'red')] }, groups: phaseOne(1), drawTop: [n(5, 'red', 1)] });
    await drawPile(alice).click();
    await select(alice, 'yellow 5', 'red 5');
    await group(alice, 'Set of 5s').getByRole('button', { name: 'Hit here' }).click();
    await expect(scoring(bob).locator('.summary-result')).toHaveText('Alice went out');
    await expect(summaryOf(bob, 'Bob')).toContainText('1 card left: +5');
  });

  test('the game ends after a hand in which someone completes phase 10, and the lowest score among them wins', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, 3);
    const fives = [n(5, 'red'), n(5, 'blue'), n(5, 'green'), n(5, 'yellow'), n(5, 'red', 1)];
    const nines = [n(9, 'red'), n(9, 'blue'), n(9, 'green'), n(9, 'yellow'), n(9, 'red', 1)];
    await deal(table, {
      hands: { 1: [n(6, 'red')], 2: [n(1, 'red')], 3: [n(2, 'red')] },
      phases: { 1: 10, 2: 10, 3: 9 },
      scores: { 1: 50, 2: 10, 3: 0 }, // Cara is lowest but has not completed phase 10
      groups: [
        setOf(1, 5, fives), setOf(1, 8, [n(8, 'red'), n(8, 'blue'), n(8, 'green')]),
        setOf(2, 9, nines), setOf(2, 10, [n(10, 'red'), n(10, 'blue'), n(10, 'green')])
      ],
      drawTop: [n(5, 'blue', 1)]
    });
    await drawPile(alice).click();
    await select(alice, 'blue 5');
    await group(alice, 'Set of 5s').getByRole('button', { name: 'Hit here' }).click();
    await discard(alice, 'red 6');

    const dialog = scoring(cara);
    await expect(dialog.getByRole('heading')).toHaveText('Final scoring');
    await expect(dialog.locator('.summary-result')).toHaveText('Bob wins with 15 points!');
    await expect(scoring(bob).locator('.summary-winner .summary-name')).toHaveText('Bob (you)');
    await expect(turnMessage(cara)).toHaveText('Game over');
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(seatOf(cara, 'Bob')).toHaveClass(/seat-winner/);
    await expect(seatOf(cara, 'Bob').locator('.seat-name')).toContainText('★');
    await expect(seatOf(cara, 'Alice')).toContainText('All phases done');
  });

  test('a tied lowest score is played off in tiebreaker hands of phase 10, and if all but one leave, that one wins', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, 3);
    const groups = [
      setOf(1, 5, [n(5, 'red'), n(5, 'blue'), n(5, 'green'), n(5, 'yellow'), n(5, 'red', 1)]),
      setOf(1, 8, [n(8, 'red'), n(8, 'blue'), n(8, 'green')]),
      setOf(2, 9, [n(9, 'red'), n(9, 'blue'), n(9, 'green'), n(9, 'yellow'), n(9, 'red', 1)]),
      setOf(2, 10, [n(10, 'red'), n(10, 'blue'), n(10, 'green')])
    ];
    // Alice goes out with 20; Bob's red 1 takes him from 15 to 20 too
    await deal(table, {
      hands: { 1: [n(5, 'yellow', 1)], 2: [n(1, 'red')], 3: [n(2, 'red')] },
      phases: { 1: 10, 2: 10, 3: 9 },
      scores: { 1: 20, 2: 15, 3: 0 },
      groups,
      drawTop: [n(5, 'blue', 1)]
    });
    await drawPile(alice).click();
    await select(alice, 'yellow 5', 'blue 5');
    await group(alice, 'Set of 5s').getByRole('button', { name: 'Hit here' }).click();
    await expect(scoring(cara).locator('.summary-result')).toHaveText('Alice went out. Tiebreaker next: Alice and Bob attempt phase 10 again');
    await expect(cara.locator('.game-status')).toContainText('Alice and Bob tie with 20 points, so they play a tiebreaker hand of phase 10');
    for (const page of [alice, bob, cara]) await scoring(page).getByRole('button', { name: 'Continue' }).click();

    await expect(turnMessage(cara)).toHaveText(/^Tiebreaker hand 2: /);
    await expect(seatOf(cara, 'Cara')).toContainText('not in the tiebreaker');
    await expect(handRegion(cara)).toContainText('Your hand (0)');
    await expect(handRegion(alice)).toContainText('Your hand (10)');
    await expect(seatOf(cara, 'Alice')).toContainText('Phase 10');

    // Still tied after the tiebreaker: it is played again, scored the same way
    await deal(table, {
      hands: { 1: [n(5, 'yellow', 1)], 2: [n(1, 'red')] },
      scores: { 1: 25, 2: 20, 3: 0 },
      groups,
      drawTop: [n(5, 'blue', 1)]
    });
    await drawPile(alice).click();
    await select(alice, 'yellow 5', 'blue 5');
    await group(alice, 'Set of 5s').getByRole('button', { name: 'Hit here' }).click();
    await expect(scoring(cara).getByRole('heading')).toHaveText('Hand 2 scoring');
    await expect(scoring(cara).locator('.summary-result')).toContainText('Tiebreaker next: Alice and Bob');
    await expect(summaryOf(cara, 'Cara')).toHaveCount(0); // Cara was not in it
    for (const page of [alice, bob, cara]) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(turnMessage(cara)).toHaveText(/^Tiebreaker hand 3: /);

    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(cara.locator('.game-status')).toHaveText('Alice wins! Everyone else in the tiebreaker left.');
  });

  test('when the draw pile runs out, the discards under the top card are shuffled into a new draw pile', async ({ seat }) => {
    const { table, alice } = await start(seat);
    const under = [n(4, 'red'), n(6, 'blue'), n(8, 'green')];
    await deal(table, { hands: { 1: tenCards('yellow'), 2: tenCards('yellow', 1) } });
    await table.patch({ drawPile: [], discardPile: [...under, n(10, 'yellow', 1)] });
    await expect(drawPile(alice)).toContainText('Draw pile (0)');
    await drawPile(alice).click();
    await expect(handRegion(alice)).toContainText('Your hand (11)');
    await expect(drawPile(alice)).toContainText('Draw pile (2)');
    await expect(discardPile(alice).locator('.card')).toHaveAttribute('aria-label', 'yellow 10');
    const state = await table.state<GameState>();
    expect(state.discardPile.map(card => card.id)).toEqual([n(10, 'yellow', 1).id]);
    expect([...state.drawPile, state.hands[1].at(-1)!].map(card => card.id).sort()).toEqual(under.map(card => card.id).sort());
  });

  test('you see only your own hand and how many cards everyone else holds', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await deal(table, { hands: { 1: tenCards('red'), 2: tenCards('green').slice(0, 7) }, discardPile: [n(12, 'yellow')] });
    await expect(handCards(alice).locator('.card')).toHaveCount(10);
    await expect(alice.locator('[aria-label^="green"]')).toHaveCount(0);
    await expect(seatOf(alice, 'Bob')).toContainText('7 cards');
    await expect(handCards(bob).locator('.card')).toHaveCount(7);
    await expect(bob.locator('[aria-label^="red"]')).toHaveCount(0);
    await expect(seatOf(bob, 'Alice')).toContainText('10 cards');
  });

  test('a player who leaves keeps their groups on the table and has their turns skipped; the last player left wins', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, 3);
    await deal(table, { hands: { 1: tenCards('red'), 2: tenCards('blue').slice(0, 4), 3: tenCards('yellow') }, groups: phaseOne(2, 1) });
    await drawPile(alice).click();
    await discard(alice, 'red 1');
    await expect(turnMessage(cara)).toHaveText("Hand 1: Bob's turn");

    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(turnMessage(alice)).toHaveText("Hand 1: Cara's turn");
    await expect(seatOf(alice, 'Bob')).toHaveClass(/seat-left/);
    await expect(seatOf(alice, 'Bob').locator('.seat-name')).toContainText('(left)');
    await expect(seatOf(alice, 'Bob').locator('.group')).toHaveCount(2);

    await drawPile(cara).click();
    await discard(cara, 'yellow 1');
    await expect(turnMessage(alice)).toHaveText("Hand 1: Alice's turn");

    await leave(cara);
    await dismiss('Cara', alice);
    await expect(alice.locator('.game-status')).toHaveText('Alice wins! Everyone else left.');
  });

  test('any player can ask to undo the last move, and it is undone only if every player still in the game approves', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, 3);
    await deal(table, { hands: { 1: tenCards('red'), 2: tenCards('blue'), 3: tenCards('green') } });
    await drawPile(alice).click();
    await expect(handRegion(alice)).toContainText('Your hand (11)');

    await bob.getByRole('button', { name: 'Undo' }).click();
    await alice.getByRole('button', { name: 'Approve' }).click();
    await cara.getByRole('button', { name: 'Decline' }).click();
    await expect(bob.locator('.undo-vote')).toHaveCount(0);
    await expect(seatOf(bob, 'Alice')).toContainText('11 cards');

    await undo(bob, alice, cara);
    await expect(handRegion(alice)).toContainText('Your hand (10)');
    await expect(drawPile(alice)).toBeEnabled();
  });
});

test.describe('Phase 10 controls', () => {
  test('with Color-blind symbols on, every number card shows its color shape, in the hand and in the History', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await deal(table, { hands: { 1: [n(3, 'red'), n(4, 'blue'), n(5, 'green'), n(6, 'yellow'), wild(0)], 2: tenCards('red', 1) } });
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
    await setPreference(alice, 'Color-blind symbols', true);
    for (const shape of ['circle', 'square', 'triangle', 'star']) await expect(handCards(alice).locator(`.color-symbol-${shape}`)).toHaveCount(1);
    await expect(handCards(alice).locator('.color-symbol')).toHaveCount(4);
    await drawPile(alice).click();
    await alice.getByRole('button', { name: 'History' }).click();
    await expect(alice.locator('.history-board .color-symbol').first()).toBeVisible();
  });

  test('the card you drew is outlined until you discard, and not with the setting off', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await deal(table, { hands: { 1: tenCards('blue'), 2: tenCards('green') }, drawTop: [n(9, 'red'), n(10, 'red')] });
    await drawPile(alice).click();
    await expect(handCards(alice).locator('.newly-drawn')).toHaveCount(1);
    await expect(handCards(alice).locator('.newly-drawn')).toHaveAccessibleName('red 10');
    await discard(alice, 'blue 1');
    await expect(handCards(alice).locator('.newly-drawn')).toHaveCount(0);
    await table.patch({ currentPlayer: 1, drawnBy: null });
    await setPreference(alice, 'Highlight newly drawn cards', false);
    await drawPile(alice).click();
    await expect(handCards(alice).getByRole('button', { name: 'red 9' })).toHaveCount(1);
    await expect(handCards(alice).locator('.newly-drawn')).toHaveCount(0);
  });

  test('the card you drew is not outlined again when the next hand is dealt with the same card', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    // Red 5 (id 4) is drawn and hit, which ends the hand; the fresh deck deals Alice the same card again
    await deal(table, { hands: { 1: [n(5, 'yellow')], 2: [n(1, 'red')] }, groups: phaseOne(1), drawTop: [n(5, 'red')] });
    await drawPile(alice).click();
    await expect(handCards(alice).locator('.newly-drawn')).toHaveCount(1);
    await select(alice, 'yellow 5', 'red 5');
    await group(alice, 'Set of 5s').getByRole('button', { name: 'Hit here' }).click();
    await table.random(...UNSHUFFLED);
    await scoring(alice).getByRole('button', { name: 'Continue' }).click();
    await scoring(bob).getByRole('button', { name: 'Continue' }).click();
    await expect(turnMessage(alice)).toHaveText("Hand 2: Bob's turn");
    await expect(handCards(alice).getByRole('button', { name: 'red 5' })).toHaveCount(1);
    await expect(handCards(alice).locator('.newly-drawn')).toHaveCount(0);
  });

  test('on your turn, click the draw pile or the discard pile to draw; both are outlined while you can draw', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await deal(table, { hands: { 1: tenCards('red'), 2: tenCards('blue') }, discardPile: [n(12, 'green')] });
    for (const pile of [drawPile(alice), discardPile(alice)]) {
      await expect(pile).toBeEnabled();
      await expect(pile).not.toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
    }
    for (const pile of [drawPile(bob), discardPile(bob)]) {
      await expect(pile).toBeDisabled();
      await expect(pile).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
    }
    await discardPile(alice).click();
    await expect(handCards(alice).getByRole('button', { name: 'green 12' })).toHaveCount(1);
    await expect(drawPile(alice)).toBeDisabled();
    await expect(drawPile(alice)).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
  });

  test('clicking cards selects them and lifts them up, and the Sort buttons order the hand by number or color', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await deal(table, {
      hands: { 1: [n(5, 'red'), n(1, 'blue'), skip(0), n(3, 'green'), wild(0), n(2, 'yellow'), n(1, 'red'), n(9, 'yellow'), n(9, 'red'), n(4, 'blue')], 2: tenCards('green') },
      drawTop: [n(12, 'blue')]
    });
    await expect.poll(() => handLabels(alice)).toEqual(['red 1', 'blue 1', 'yellow 2', 'green 3', 'blue 4', 'red 5', 'red 9', 'yellow 9', 'Wild', 'Skip']);
    await button(alice, 'Color').click();
    await expect(button(alice, 'Color')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => handLabels(alice)).toEqual(['red 1', 'red 5', 'red 9', 'blue 1', 'blue 4', 'green 3', 'yellow 2', 'yellow 9', 'Wild', 'Skip']);
    await button(alice, 'Number').click();
    await expect.poll(() => handLabels(alice)).toEqual(['red 1', 'blue 1', 'yellow 2', 'green 3', 'blue 4', 'red 5', 'red 9', 'yellow 9', 'Wild', 'Skip']);

    await drawPile(alice).click();
    const card = handCards(alice).getByRole('button', { name: 'red 5' });
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(card).toHaveClass(/card-selected/);
    await expect(card).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -8)');
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'false');
    await expect(card).toHaveCSS('transform', 'none');
  });

  test('stage cards with Add selected to group, click a staged card to put it back or Clear, and Lay down phase once every group is right', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await deal(table, {
      hands: { 1: [n(4, 'red'), n(4, 'blue'), n(4, 'green'), n(6, 'red'), n(6, 'blue'), n(6, 'green'), n(1, 'red'), n(2, 'red'), n(3, 'red'), n(9, 'blue')], 2: tenCards('yellow') },
      drawTop: [n(12, 'blue')]
    });
    await drawPile(alice).click();
    const panel = alice.locator('.lay-down');
    await expect(button(alice, 'Add selected to group 1')).toBeDisabled();
    await stage(alice, 1, 'red 4', 'blue 4', 'green 4');
    await expect(panel.locator('.lay-down-part').nth(0).locator('.card')).toHaveCount(3);
    await expect(handCards(alice).getByRole('button', { name: 'red 4' })).toHaveCount(0);
    await panel.getByRole('button', { name: 'blue 4' }).click();
    await expect(panel.locator('.lay-down-part').nth(0).locator('.card')).toHaveCount(2);
    await expect(handCards(alice).getByRole('button', { name: 'blue 4' })).toHaveCount(1);
    await button(alice, 'Clear').click();
    await expect(panel.locator('.card')).toHaveCount(0);
    await expect(handCards(alice).locator('.card')).toHaveCount(11);

    await stage(alice, 1, 'red 4', 'blue 4', 'green 4');
    await expect(button(alice, 'Lay down phase')).toBeDisabled();
    await stage(alice, 2, 'red 6', 'blue 6', 'green 6');
    await expect(button(alice, 'Lay down phase')).toBeEnabled();
    await button(alice, 'Lay down phase').click();
    await expect(group(alice, 'Set of 4s')).toHaveCount(1);
    await expect(group(alice, 'Set of 6s')).toHaveCount(1);
  });

  test('after your phase is down, select cards and click Hit here on any group', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await deal(table, {
      hands: { 1: [n(5, 'yellow'), n(7, 'yellow'), n(2, 'red')], 2: tenCards('blue', 1).slice(0, 4) },
      groups: [...phaseOne(1), setOf(2, 11, [n(11, 'red'), n(11, 'blue'), n(11, 'green')])],
      drawTop: [n(11, 'yellow')]
    });
    await drawPile(alice).click();
    await expect(alice.locator('.hit-button')).toHaveCount(0);
    await select(alice, 'yellow 11');
    await expect(alice.locator('.hit-button')).toHaveCount(3);
    await group(alice, 'Set of 11s').getByRole('button', { name: 'Hit here' }).click();
    await expect(group(alice, 'Set of 11s').locator('.card')).toHaveCount(4);
    await expect(alice.locator('.game-status')).toHaveText("Alice hit 1 card on Bob's set");
  });

  test('select one card and click Discard selected card to end your turn; for a Skip, click the player to skip', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, 3);
    await deal(table, { hands: { 1: [skip(0), ...tenCards('red').slice(1)], 2: [skip(1), ...tenCards('blue').slice(1)], 3: tenCards('green') } });
    await drawPile(alice).click();
    const discardButton = button(alice, 'Discard selected card');
    await expect(discardButton).toBeDisabled();
    await select(alice, 'red 2', 'red 3');
    await expect(discardButton).toBeDisabled(); // two cards selected
    await button(alice, 'Deselect').click();
    await select(alice, 'red 2');
    await discardButton.click();
    await expect(turnMessage(alice)).toHaveText("Hand 1: Bob's turn");

    await drawPile(bob).click();
    await select(bob, 'Skip');
    await expect(button(bob, 'Discard selected card')).toHaveCount(0);
    await expect(button(bob, /^Discard Skip on /)).toHaveCount(2);
    await button(bob, 'Discard Skip on Alice').click();
    await expect(cara.locator('.game-status')).toHaveText('Bob discarded a Skip on Alice');
  });

  test('every player is listed with phase, score, card count and groups, the current player outlined, and your hand dimmed off-turn', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await deal(table, { hands: { 1: tenCards('red'), 2: tenCards('blue').slice(0, 4) }, groups: phaseOne(2, 1), scores: { 1: 30, 2: 45 }, phases: { 1: 3, 2: 2 } });
    const bobSeat = seatOf(alice, 'Bob');
    await expect(bobSeat).toContainText('Phase 2: 1 set of 3 + 1 run of 4');
    await expect(bobSeat.locator('.seat-score')).toHaveText('45 pts');
    await expect(bobSeat).toContainText('4 cards');
    await expect(bobSeat.locator('.group')).toHaveCount(2);
    await expect(seatOf(alice, 'Alice').locator('.seat-name')).toHaveText('Alice (you)');
    await expect(seatOf(alice, 'Alice')).toContainText('30 pts');

    await expect(seatOf(bob, 'Alice')).toHaveClass(/seat-current/);
    await expect(seatOf(bob, 'Bob')).not.toHaveClass(/seat-current/);
    await expect(seatOf(bob, 'Alice')).not.toHaveCSS('border-top-color', await seatOf(bob, 'Bob').evaluate(element => getComputedStyle(element).borderTopColor));
    await expect(handRegion(bob)).toHaveClass(/my-hand-waiting/);
    await expect(handRegion(bob)).toHaveCSS('opacity', '0.6');
    await expect(handRegion(alice)).not.toHaveClass(/my-hand-waiting/);
  });

  test('after each hand the scoring screen waits for everyone to click Continue', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await deal(table, { hands: { 1: [n(5, 'yellow')], 2: [n(1, 'red')] }, groups: phaseOne(1), drawTop: [n(5, 'red', 1)] });
    await drawPile(alice).click();
    await select(alice, 'yellow 5', 'red 5');
    await group(alice, 'Set of 5s').getByRole('button', { name: 'Hit here' }).click();
    await scoring(bob).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(bob)).toContainText('Waiting for Alice');
    await expect(scoring(alice).getByRole('button', { name: 'Continue' })).toBeVisible();
    await scoring(alice).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(bob)).toHaveCount(0);
    await expect(turnMessage(bob)).toHaveText(/^Hand 2: /);
  });

  test('cards slide where they went, and nothing animates with reduced motion', async ({ seat }) => {
    const animated = await start(seat, 2, { motion: true });
    await deal(animated.table, { hands: { 1: tenCards('blue'), 2: tenCards('green') } });
    await animated.alice.locator('.piles .pile').nth(0).click();
    await expect.poll(() => animated.bob.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
    await expect.poll(() => animated.bob.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(animated.bob.locator('.game-screen > .card')).toHaveCount(0);

    const still = await start(seat);
    await deal(still.table, { hands: { 1: tenCards('blue'), 2: tenCards('green') } });
    await still.alice.locator('.piles .pile').nth(0).click();
    await expect(still.bob.getByText('Alice drew from the pile')).toBeVisible();
    expect(await still.bob.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('clicking Undo asks everyone to approve undoing the last move', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, 3);
    await deal(table, { hands: { 1: tenCards('red'), 2: tenCards('blue'), 3: tenCards('green') } });
    await drawPile(alice).click();
    await alice.getByRole('button', { name: 'Undo' }).click();
    await expect(bob.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(cara.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('FAQ at the top of the page covers the rules, the ten phases and the controls', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('What are the ten phases?');
    await expect(faq).toContainText('How does a turn work?');
    await expect(faq).toContainText('How do I lay down my phase?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Phase 10 house rules', () => {
  test('laying down a later phase first', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, 2, { houseRules: { anyOrder: true } });
    await deal(table, {
      hands: { 1: [...[1, 2, 3, 4, 5, 6, 7, 8].map(value => n(value, 'red')), n(9, 'red')], 2: tenCards('yellow') },
      drawTop: [n(10, 'red')]
    });
    await expect(seatOf(alice, 'Alice')).toContainText('No phases done yet');
    await drawPile(alice).click();

    // Phase 1 is offered first, and any phase not completed can be picked instead
    const picker = alice.getByLabel('Phase to lay down');
    await expect(picker.locator('option')).toHaveCount(10);
    await expect(alice.locator('.lay-down-part')).toHaveCount(2);
    await picker.selectOption({ label: 'Phase 5: 1 run of 8' });
    await expect(alice.locator('.lay-down-title')).toHaveText('Lay down phase 5');
    await expect(alice.locator('.lay-down-part')).toHaveCount(1);
    await stage(alice, 1, ...[1, 2, 3, 4, 5, 6, 7, 8].map(value => `red ${value}`));
    await button(alice, 'Lay down phase').click();
    await expect(group(alice, 'Run 1 to 8')).toHaveCount(1);
    await expect(bob.locator('.game-status')).toContainText('Alice laid down phase 5');

    // Hitting the last cards out ends the hand: phase 5 is done, and Bob laid nothing down
    await select(alice, 'red 9', 'red 10');
    await group(alice, 'Run 1 to 8').getByRole('button', { name: 'Hit here' }).click();
    await expect(summaryOf(bob, 'Alice')).toContainText('Phase 5 done');
    await expect(summaryOf(bob, 'Bob')).toContainText('No phase laid down');
    await scoring(bob).getByRole('button', { name: 'Continue' }).click();
    await scoring(alice).getByRole('button', { name: 'Continue' }).click();
    await expect(seatOf(alice, 'Alice')).toContainText('Done: 5 (1/10)');
    await expect(seatOf(bob, 'Bob')).toContainText('No phases done yet');

    // Phase 5 is no longer offered
    await table.patch({ currentPlayer: 1, drawnBy: 1 });
    await expect(alice.getByLabel('Phase to lay down').locator('option')).toHaveCount(9);
    await expect(alice.getByLabel('Phase to lay down').locator('option', { hasText: 'Phase 5:' })).toHaveCount(0);
  });

  test('without the rule there is no phase picker', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await deal(table, { hands: { 1: tenCards('red'), 2: tenCards('yellow') }, drawTop: [n(12, 'blue')] });
    await drawPile(alice).click();
    await expect(alice.locator('.lay-down-title')).toHaveText('Lay down phase 1');
    await expect(alice.getByLabel('Phase to lay down')).toHaveCount(0);
  });
});

test.describe('Phase 10 house rules', () => {
  test('8 players can join with the override', async ({ seat }) => {
    const names = Array.from({ length: 8 }, (_, index) => `Player${index + 1}`);
    const table = await seat('phase10', names, { maxPlayers: 8 });
    expect(table.pages).toHaveLength(8);
    expect((await table.state<{ activePlayers: number[] }>()).activePlayers).toHaveLength(8);
    for (const page of table.pages) await expect(page.getByText('Game is full')).toHaveCount(0);
  });
});
