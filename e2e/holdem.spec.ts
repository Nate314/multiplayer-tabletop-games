import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, seeTable, test, undo, type Seat, type Table } from './fixtures.ts';
import { cardName, sameCard, type PlayingCard, type Rank, type Suit } from '../shared/playingCards.ts';
import type { GameState } from '../games/holdem/types.ts';

// One test per rule, control and difference in games/holdem/README.md. Seats 1 to 4 are Alice, Bob, Cara and Dan.
// The deck's top card is its last one.

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan'];
const SUIT: Record<string, Suit> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' };
// 'Ah Kd 10c' style card lists
const cards = (text: string): PlayingCard[] =>
  text.split(' ').map(code => ({ rank: code.slice(0, -1) as Rank, suit: SUIT[code.slice(-1)] }));

async function start(seat: Seat, count = 3, motion = false) {
  const table = await seat('holdem', NAMES.slice(0, count), { motion });
  return { table, pages: table.pages, alice: table.pages[0], bob: table.pages[1], cara: table.pages[2], dan: table.pages[3] };
}

// The hand on the river with nothing bet this round, the cards fixed and `chips` behind each player.
// The last seat has the button, so Alice acts first.
async function river(table: Table, chips: number[], holes: string[], board: string, extra: Partial<GameState> = {}) {
  const seats = chips.map((_, index) => index + 1);
  const record = <T>(values: T[]) => Object.fromEntries(seats.map((seat, index) => [seat, values[index]]));
  await table.patch({
    chips: record(chips),
    holeCards: record(holes.map(cards)),
    deck: cards('2c 3c 4c 5c 6c'),
    board: cards(board),
    street: 'river',
    dealtIn: seats,
    folded: [],
    bets: record(seats.map(() => 0)),
    contributed: record(seats.map(() => 0)),
    currentBet: 0,
    raiseSize: 20,
    actedAt: {},
    button: seats.length,
    currentPlayer: 1,
    lastMove: null,
    ...extra
  });
}

const seatOf = (page: Page, name: string) => page.locator(`[aria-label="${name}'s seat"]`);
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.turn-message');
const result = (page: Page) => page.getByRole('region', { name: 'Hand result' });
const board = (page: Page) => page.getByRole('region', { name: 'Board' }).locator('.playing-card');
const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });
const fold = (page: Page) => button(page, 'Fold').click();
const check = (page: Page) => button(page, 'Check').click();
const call = (page: Page) => button(page, /^Call \d/).click();
const allIn = (page: Page) => button(page, 'All in').click();
// Waits for the turn first: a new turn resets the amount to the smallest raise
async function raise(page: Page, to: number) {
  const amount = page.getByLabel('Amount');
  await expect(amount).toBeEnabled();
  await expect(async () => {
    await amount.fill(String(to));
    await expect(amount).toHaveValue(String(to), { timeout: 200 });
  }).toPass();
  await page.locator('.holdem-raise button').first().click();
}
// Every page with chips clicks Continue
async function continueAll(...pages: Page[]) {
  for (const page of pages) await button(page, 'Continue').click();
}

test.describe("Texas Hold'em rules", () => {
  test('everyone starts with 1,000 chips and the blinds are 10 and 20', async ({ seat }) => {
    const { alice } = await start(seat);
    await expect(seatOf(alice, 'Alice').locator('.holdem-seat-chips')).toHaveText('1,000 chips');
    await expect(seatOf(alice, 'Bob').locator('.holdem-seat-chips')).toHaveText('990 chips');
    await expect(seatOf(alice, 'Bob').locator('.holdem-seat-bet')).toHaveText('Bet 10');
    await expect(seatOf(alice, 'Cara').locator('.holdem-seat-bet')).toHaveText('Bet 20');
    await expect(alice.locator('.holdem-pots')).toHaveText('Pot: 30');
  });

  test('the button moves to the next player each hand with the blinds left of it, and heads-up the button posts the small blind', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await expect(seatOf(alice, 'Alice').getByLabel('Dealer button')).toBeVisible();
    await fold(alice);
    await fold(bob);
    await continueAll(alice, bob, cara);
    await expect(seatOf(alice, 'Bob').getByLabel('Dealer button')).toBeVisible();
    await expect(seatOf(alice, 'Cara').locator('.holdem-seat-bet')).toHaveText('Bet 10');
    await expect(seatOf(alice, 'Alice').locator('.holdem-seat-bet')).toHaveText('Bet 20');

    const headsUp = await start(seat, 2);
    await expect(seatOf(headsUp.alice, 'Alice').getByLabel('Dealer button')).toBeVisible();
    await expect(seatOf(headsUp.alice, 'Alice').locator('.holdem-seat-bet')).toHaveText('Bet 10');
    await expect(seatOf(headsUp.alice, 'Bob').locator('.holdem-seat-bet')).toHaveText('Bet 20');
  });

  test('two hole cards each, then a burned card before the flop, the turn and the river', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await expect(seatOf(alice, 'Alice').locator('.playing-card:not(.playing-card-back)')).toHaveCount(2);
    await expect(seatOf(alice, 'Bob').locator('.playing-card-back')).toHaveCount(2);
    await call(alice);
    await call(bob);
    await check(cara);
    await expect(board(alice)).toHaveCount(3);
    expect((await table.state<GameState>()).deck).toHaveLength(52 - 6 - 4);
    await check(bob);
    await check(cara);
    await check(alice);
    await expect(board(alice)).toHaveCount(4);
    expect((await table.state<GameState>()).deck).toHaveLength(52 - 6 - 6);
    await check(bob);
    await check(cara);
    await check(alice);
    await expect(board(alice)).toHaveCount(5);
  });

  test('left of the big blind acts first before the flop, left of the button after it, and heads-up the button acts first', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await expect(turn(alice)).toHaveText('You act first. Joining closes after the first move.');
    await expect(button(bob, 'Fold')).toBeDisabled();
    await call(alice);
    await call(bob);
    await check(cara);
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(turn(alice)).toHaveText("Bob's turn");

    const headsUp = await start(seat, 2);
    await expect(turn(headsUp.alice)).toHaveText('You act first. Joining closes after the first move.');
    await call(headsUp.alice);
    await check(headsUp.bob);
    await expect(turn(headsUp.bob)).toHaveText('Your turn');
  });

  test('a raise must be at least the last raise, and a short all-in does not reopen the betting', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await alice.getByLabel('Amount').fill('39');
    await expect(button(alice, 'Raise to')).toBeDisabled();
    await raise(alice, 40);
    await expect(status(bob)).toHaveText('Alice raised to 40');
    await expect(bob.getByLabel('Amount')).toHaveValue('60');
    await raise(bob, 100);
    await expect(cara.getByLabel('Amount')).toHaveValue('160');
    await expect(cara.locator('.hint')).toHaveText('Call 80, raise to 160 or more, or fold');

    const short = await start(seat);
    await short.table.patch({ chips: { 1: 1000, 2: 40, 3: 980 } });
    await raise(short.alice, 40);
    await allIn(short.bob);
    await expect(status(short.cara)).toHaveText('Bob raised to 50 (all in)');
    await call(short.cara);
    await expect(button(short.alice, 'Call 10')).toBeEnabled();
    await expect(short.alice.locator('.hint')).toHaveText('Call 10, or fold');
    await expect(button(short.alice, 'Raise to')).toBeDisabled();
    await expect(button(short.alice, 'All in')).toBeDisabled();
  });

  test('a round ends when everyone has matched or is all in, and with nobody left to bet the board is dealt out', async ({ seat }) => {
    const { alice, bob } = await start(seat, 2);
    await allIn(alice);
    await call(bob);
    await expect(board(alice)).toHaveCount(5);
    await expect(status(alice)).toHaveText(/^Bob called 980 \(all in\)\. The board is dealt out\. /);
    await expect(result(alice)).toBeVisible();
  });

  test('a blind that puts a player all in deals the board out, and the result and History show that hand', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, 2);
    await fold(alice);
    // Bob takes the button and can post only 5; an unshuffled deck gives Alice a king-high flush
    await table.patch({ chips: { 1: 1995, 2: 5 } });
    await table.random(...Array.from({ length: 51 }, () => 0.999999));
    await continueAll(alice, bob);
    await expect(status(bob)).toHaveText(
      'Hand 2: Bob has the button. The board is dealt out. Alice wins 10 with Flush, king high; Alice gets back 15 uncalled. Alice has every chip and wins!'
    );
    await expect(board(bob)).toHaveCount(5);
    await expect(result(bob).locator('.holdem-result-pots li')).toHaveText(['Pot of 10: Alice with Flush, king high', 'Alice gets back 15 uncalled']);
    // The hand was dealt by Continue, not a move, so History shows it as the end of the game
    await seeTable(bob);
    await bob.getByRole('button', { name: 'History' }).click();
    const dialog = bob.getByRole('dialog', { name: 'History' });
    await expect(dialog.locator('.history-move')).toHaveText(/^End of the game: Hand 2: Bob has the button\. The board is dealt out\./);
    await expect(dialog.locator('.holdem-board .playing-card')).toHaveCount(5);
    await expect(dialog.getByRole('region', { name: 'Hand result' })).toContainText('Alice gets back 15 uncalled');
  });

  test('side pots split correctly with three different all-in amounts, and an uncalled bet goes back', async ({ seat }) => {
    const { table, pages, alice, bob, cara, dan } = await start(seat, 4);
    await river(table, [100, 300, 600, 1000], ['Ah As', 'Kh Ks', 'Qh Qs', '3d 4h'], '2c 7d 9h Jc 8s');
    await raise(alice, 100);
    await raise(bob, 300);
    await expect(dan.locator('.holdem-pots')).toHaveText('Pot: 200Side pot 1: 200 (Bob, Cara, Dan)');
    await raise(cara, 600);
    await call(dan);
    for (const page of pages) {
      await expect(result(page).locator('.holdem-result-pots li')).toHaveText([
        'Pot of 400: Alice with Pair of aces',
        'Side pot 1 of 600: Bob with Pair of kings',
        'Side pot 2 of 600: Cara with Pair of queens'
      ]);
    }
    await expect(seatOf(alice, 'Dan').locator('.holdem-seat-chips')).toHaveText('400 chips');

    const uncalled = await start(seat, 2);
    await river(uncalled.table, [1000, 200], ['Ah As', 'Kh Ks'], '2c 7d 9h Jc 8s');
    await raise(uncalled.alice, 500);
    await call(uncalled.bob);
    await expect(result(uncalled.bob).locator('.holdem-result-pots li')).toHaveText([
      'Pot of 400: Alice with Pair of aces', 'Alice gets back 300 uncalled'
    ]);

    // Bob put in 300 and folded: of Cara's side pot, 400 was won and only 300 was uncalled
    const folded = await start(seat);
    await river(folded.table, [100, 1000, 1000], ['3d 4h', 'Kh Ks', 'Ah As'], '2c 7d 9h Jc 8s');
    await raise(folded.alice, 100);
    await raise(folded.bob, 300);
    await raise(folded.cara, 600);
    await fold(folded.bob);
    await expect(result(folded.alice).locator('.holdem-result-pots li')).toHaveText([
      'Pot of 300: Cara with Pair of aces', 'Side pot 1 of 400: Cara', 'Cara gets back 300 uncalled'
    ]);
  });

  test('the last player in wins without showing; at a showdown the hands are shown and the best five cards win', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await fold(alice);
    await fold(bob);
    await expect(result(alice).locator('li')).toHaveText(['Pot of 30: Cara']);
    await expect(seatOf(alice, 'Cara').locator('.playing-card-back')).toHaveCount(2);
    await expect(seatOf(alice, 'Cara').locator('.holdem-seat-won')).toHaveText('Won 30');

    const shown = await start(seat, 2);
    // Alice's ace makes a straight with the board, which beats Bob's pair
    await river(shown.table, [500, 500], ['Ah 2s', '3d 3h'], '10c Jd Qh Kc 4s');
    await check(shown.alice);
    await check(shown.bob);
    await expect(seatOf(shown.bob, 'Alice').getByRole('img', { name: 'ace of hearts' })).toBeVisible();
    await expect(seatOf(shown.bob, 'Alice').locator('.holdem-seat-hand')).toHaveText('Straight, ace high');
    await expect(seatOf(shown.bob, 'Bob').locator('.holdem-seat-hand')).toHaveText('Pair of threes');
  });

  test('a split pot gives the odd chip to the first winner left of the button', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await river(table, [100, 100, 1000], ['Ah 2s', 'Kh 2d', '3c 4c'], '5c 6d 7h 8c 9s', {
      contributed: { 1: 15, 2: 15, 3: 5 }, folded: [3], button: 3
    });
    await check(alice);
    await check(bob);
    await expect(result(alice).locator('li')).toHaveText(['Pot of 35: Alice and Bob with Straight, nine high']);
    await expect(seatOf(alice, 'Alice').locator('.holdem-seat-won')).toHaveText('Won 18');
    await expect(seatOf(alice, 'Bob').locator('.holdem-seat-won')).toHaveText('Won 17');
  });

  test('the next hand is dealt once every connected player with chips presses Continue', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await fold(alice);
    await fold(bob);
    await button(alice, 'Continue').click();
    await expect(alice.locator('.holdem-waiting')).toHaveText('Waiting for Bob, Cara');
    await leave(cara);
    await expect(alice.locator('.holdem-waiting')).toHaveText('Waiting for Bob');
    await button(bob, 'Continue').click();
    await expect(alice.locator('.holdem-hand-number')).toHaveText('Hand 2');
  });

  test('a player with no chips is out and skipped', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await table.patch({ holeCards: { 1: cards('Ah As'), 2: cards('7d 2c'), 3: cards('Kh Ks') }, deck: cards('3h 4h 9c Jd 5s 8d 10h 6h') });
    await allIn(alice);
    await fold(bob);
    await call(cara);
    await expect(status(cara)).toHaveText(/Alice wins 2,010 with Pair of aces\. Cara is out of chips$/);
    await expect(button(cara, 'Continue')).toHaveCount(0);
    await continueAll(alice, bob);
    await expect(seatOf(cara, 'Cara').locator('.holdem-seat-note')).toHaveText('Out of chips');
    await expect(seatOf(cara, 'Cara').locator('.playing-card')).toHaveCount(0);
    await expect(turn(cara)).toHaveText('You are out of chips and watching');
    await expect(seatOf(alice, 'Bob').getByLabel('Dealer button')).toBeVisible();
    await expect(seatOf(alice, 'Bob').locator('.holdem-seat-bet')).toHaveText('Bet 10');
  });

  test('the end vote ends the game only when every player with chips votes yes, ranked by chips', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await fold(alice);
    await fold(bob);
    await table.patch({ chips: { 1: 1200, 2: 0, 3: 1800 } });
    await expect(button(bob, 'Vote to end the game')).toHaveCount(0);
    await button(alice, 'Vote to end the game').click();
    await expect(cara.locator('.holdem-end-votes')).toHaveText('Votes to end: Alice (1 of 2)');
    await button(cara, 'Vote to end the game').click();
    await expect(turn(bob)).toHaveText('Game over: Cara wins');
    await expect(status(bob)).toHaveText('The game ends by vote: Cara 1,800, Alice 1,200, Bob 0');
    await expect(bob.locator('.holdem-standings li')).toHaveText(['Cara: 1,800 chips', 'Alice: 1,200 chips', 'Bob: 0 chips']);
  });

  test('one player with every chip ends the game', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, 2);
    await river(table, [5, 5], ['Ah As', 'Kh Ks'], '2c 7d 9h Jc 8s', { contributed: { 1: 995, 2: 995 } });
    await allIn(alice);
    await call(bob);
    await expect(status(bob)).toHaveText(/Alice has every chip and wins!$/);
    await expect(turn(bob)).toHaveText('Game over: Alice wins');
  });

  test('table view hides hands: only hands shown at a showdown reach History and the game file', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    const state = await table.state<GameState>();
    const [aliceCards, bobCards, caraCards] = [1, 2, 3].map(held => state.holeCards[held]);
    await fold(alice);
    await call(bob);
    await check(cara);
    for (let street = 0; street < 3; street++) {
      await check(bob);
      await check(cara);
    }
    await expect(result(alice)).toBeVisible();
    await expect(seatOf(alice, 'Bob').getByRole('img', { name: cardName(bobCards[0]) })).toBeVisible();
    for (const page of [alice, bob, cara]) await button(page, 'Vote to end the game').click();
    await expect(turn(alice)).toHaveText(/^Game over/);

    await seeTable(alice);
    await alice.getByRole('button', { name: 'History' }).click();
    const dialog = alice.getByRole('dialog', { name: 'History' });
    const slider = dialog.getByRole('slider', { name: 'Step' });
    const steps = Number(await slider.getAttribute('max'));
    for (let step = 0; step <= steps; step++) {
      await slider.fill(String(step));
      for (const held of aliceCards) await expect(dialog.getByRole('img', { name: cardName(held), exact: true })).toHaveCount(0);
      if (step < steps - 1) {
        for (const held of [...bobCards, ...caraCards]) await expect(dialog.getByRole('img', { name: cardName(held), exact: true })).toHaveCount(0);
      }
    }

    const downloading = alice.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download game' }).click();
    const file = JSON.parse(await readFile(await (await downloading).path(), 'utf8')) as { steps: Record<string, unknown>[] };
    for (const step of file.steps) {
      const { views, ...tableView } = step;
      const text = JSON.stringify(tableView);
      for (const held of aliceCards) expect(text).not.toContain(JSON.stringify(held));
      const seatViews = views as Record<string, { myCards: PlayingCard[] }>;
      // Each seat's view holds only that seat's own hole cards
      expect(seatViews['2'].myCards.every(held => bobCards.some(other => sameCard(other, held)))).toBe(true);
    }
  });

  test('a player leaving folds their hand, their chips leave the table and the hand goes on', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await raise(alice, 60);
    await expect(turn(bob)).toHaveText('Your turn');
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(seatOf(alice, 'Bob')).toHaveCount(0);
    await expect(turn(alice)).toHaveText("Cara's turn");
    await expect(alice.locator('.holdem-pots')).toHaveText('Pot: 90');
    await call(cara);
    await expect(board(alice)).toHaveCount(3);
  });

  test('undo puts the bet back only when everyone approves', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await raise(alice, 60);
    await expect(seatOf(bob, 'Alice').locator('.holdem-seat-bet')).toHaveText('Bet 60');
    await undo(alice, bob, cara);
    await expect(status(alice)).toHaveText('Last turn undone');
    await expect(seatOf(alice, 'Alice').locator('.holdem-seat-bet')).toHaveCount(0);
    await expect(turn(alice)).toHaveText('Your turn');
  });
});

test.describe("Texas Hold'em controls", () => {
  test('Fold, Check and Call, with Call showing what you owe', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await expect(button(alice, 'Call 20')).toBeEnabled();
    await expect(button(alice, 'Check')).toHaveCount(0);
    await call(alice);
    await expect(button(bob, 'Call 10')).toBeEnabled();
    await fold(bob);
    await expect(button(cara, 'Check')).toBeEnabled();
    await check(cara);
    await expect(status(alice)).toHaveText('Cara checked. The flop is dealt');
  });

  test('Amount starts at the smallest raise; Bet or Raise to bets that total, and All in bets everything', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await expect(alice.getByLabel('Amount')).toHaveValue('40');
    await raise(alice, 75);
    await expect(status(bob)).toHaveText('Alice raised to 75');
    await call(bob);
    await call(cara);
    await expect(bob.getByLabel('Amount')).toHaveValue('20');
    await expect(button(bob, 'Bet')).toBeEnabled();
    await raise(bob, 20);
    await expect(status(cara)).toHaveText('Bob bet 20');
    await allIn(cara);
    await expect(status(alice)).toHaveText('Cara raised to 925 (all in)');
  });

  test('the table shows chips, bets, cards, the button, the current player, the board and the pots', async ({ seat }) => {
    const { alice } = await start(seat);
    await expect(seatOf(alice, 'Alice')).toHaveClass(/holdem-seat-current/);
    await expect(seatOf(alice, 'Alice').locator('.holdem-seat-name')).toHaveText('Alice (you)');
    await expect(seatOf(alice, 'Bob').locator('.playing-card-back')).toHaveCount(2);
    await expect(alice.getByRole('region', { name: 'Board' }).locator('.holdem-board-empty')).toHaveCount(5);
    await expect(alice.locator('.holdem-hand-number')).toHaveText('Hand 1');
  });

  test('after a hand, Continue deals the next one, and the end vote can be taken back', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await fold(alice);
    await fold(bob);
    await button(alice, 'Vote to end the game').click();
    await expect(button(alice, 'Take back my vote to end')).toBeVisible();
    await button(alice, 'Take back my vote to end').click();
    await expect(status(bob)).toHaveText('Alice wants to keep playing');
    await expect(bob.locator('.holdem-end-votes')).toHaveCount(0);
    await continueAll(alice, bob, cara);
    await expect(result(alice)).toHaveCount(0);
  });

  test('clicking Undo asks the others to undo the last move', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await expect(button(alice, 'Undo')).toBeDisabled();
    await call(alice);
    await button(alice, 'Undo').click();
    await expect(bob.locator('.undo-vote')).toContainText('Alice wants to undo the last turn');
  });

  test('History steps through every move, and FAQ shows the rules and controls', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await raise(alice, 60);
    await fold(bob);
    await alice.getByRole('button', { name: 'History' }).click();
    const dialog = alice.getByRole('dialog', { name: 'History' });
    await expect(dialog.locator('.history-move')).toHaveText('Move 2 of 2: Bob folded');
    await dialog.getByRole('slider', { name: 'Step' }).fill('1');
    await expect(dialog.locator('.history-move')).toHaveText('Move 1 of 2: Alice raised to 60');
    await dialog.getByRole('button', { name: 'Close' }).click();
    const faq = await openFaq(alice);
    await expect(faq).toContainText('Raise to');
    await expect(faq).toContainText('closest to the left of the button');
  });

  test('new board cards slide in, and nothing animates with reduced motion', async ({ seat }) => {
    const animated = await start(seat, 2, true);
    await call(animated.alice);
    await check(animated.bob);
    await expect.poll(() => animated.alice.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);

    const still = await start(seat, 2);
    await call(still.alice);
    await check(still.bob);
    await expect(board(still.alice)).toHaveCount(3);
    expect(await still.alice.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});

test.describe("Texas Hold'em differences from Wikipedia", () => {
  test('the blinds stay at 10 and 20', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    for (let hand = 0; hand < 2; hand++) {
      await expect(alice.locator('.holdem-seat-bet')).toHaveCount(2);
      const bets = await alice.locator('.holdem-seat-bet').allTextContents();
      expect(bets.sort()).toEqual(['Bet 10', 'Bet 20']);
      const actor = [alice, bob, cara][hand === 0 ? 0 : 1];
      const next = [alice, bob, cara][hand === 0 ? 1 : 2];
      await fold(actor);
      await fold(next);
      await continueAll(alice, bob, cara);
    }
  });

  test('the first player to join has the first button', async ({ seat }) => {
    const { bob } = await start(seat, 4);
    await expect(seatOf(bob, 'Alice').getByLabel('Dealer button')).toBeVisible();
  });

  test('the button moves to the next player who still has chips', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await fold(alice);
    await fold(bob);
    await table.patch({ chips: { 1: 1000, 2: 0, 3: 2000 } });
    await continueAll(alice, cara);
    await expect(seatOf(alice, 'Cara').getByLabel('Dealer button')).toBeVisible();
  });

  test('short all-ins that add up to a full raise reopen the betting', async ({ seat }) => {
    const { table, alice, bob, cara, dan } = await start(seat, 4);
    await table.patch({ chips: { 1: 150, 2: 190, 3: 980, 4: 1000 } });
    await raise(dan, 100);
    await allIn(alice);
    await allIn(bob);
    await call(cara);
    await expect(button(dan, 'Raise to')).toBeEnabled();
  });

  test('side pots name who can win them', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await river(table, [100, 1000, 1000], ['Ah As', 'Kh Ks', 'Qh Qs'], '2c 7d 9h Jc 8s');
    await allIn(alice);
    await raise(bob, 300);
    await expect(cara.locator('.holdem-pots')).toHaveText('Pot: 200Side pot 1: 200 (Bob, Cara)');
  });

  test('every hand still in is shown at once, and an uncontested winner has no way to show', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await fold(alice);
    await fold(bob);
    await expect(cara.getByRole('button', { name: /show/i })).toHaveCount(0);
    await expect(seatOf(alice, 'Cara').locator('.playing-card-back')).toHaveCount(2);
  });

  test('a player with no chips is out, and the game ends by a vote of the players with chips', async ({ seat }) => {
    const { table, alice, bob, cara } = await start(seat);
    await fold(alice);
    await fold(bob);
    await table.patch({ chips: { 1: 0, 2: 1000, 3: 2000 } });
    await expect(button(alice, 'Vote to end the game')).toHaveCount(0);
    await button(bob, 'Vote to end the game').click();
    await button(cara, 'Vote to end the game').click();
    await expect(turn(alice)).toHaveText('Game over: Cara wins');
  });

  test('a player leaving mid-hand has their hand folded and their chips taken off the table', async ({ seat }) => {
    const { alice, bob, cara } = await start(seat);
    await call(alice);
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(seatOf(alice, 'Cara')).toHaveCount(0);
    await expect(alice.locator('.holdem-pots')).toHaveText('Pot: 50');
    await expect(turn(bob)).toHaveText('Your turn');
  });
});

test.describe("Texas Hold'em house rules", () => {
  test('10 players can join with Most players raised', async ({ seat }) => {
    const names = Array.from({ length: 10 }, (_, index) => `Player${index + 1}`);
    const table = await seat('holdem', names, { maxPlayers: 10 });
    expect(table.pages).toHaveLength(10);
    expect((await table.state<{ activePlayers: number[] }>()).activePlayers).toHaveLength(10);
    for (const page of table.pages) await expect(page.getByText('Game is full')).toHaveCount(0);
  });
});
