import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, setPreference, test, undo, type Seat, type SeatOptions, type Table } from './fixtures.ts';
import { buildDeck, sameCard } from '../games/uno/rules.ts';
import type { Card, Color, GameState, Value } from '../games/uno/types.ts';

// One test per rule, control and difference in games/uno/README.md. Players are seated in join order:
// Alice is seat 1, Bob seat 2, Cara seat 3. Piles keep their top card last, as the server does.

const c = (color: Color | 'wild', value: Value): Card => ({ color, value });
const WILD = c('wild', 'wild');
const FOUR = c('wild', 'wildDrawFour');
// Plenty of green cards to draw, none of which plays on red
const GREENS = (['1', '2', '3', '4', '6', '7', '8', '9'] as Value[]).map(value => c('green', value));

// The random numbers for one shuffle of the full deck that put `top` on top (its first card first), the rest in order.
// Fisher-Yates swaps index i with floor(random * (i + 1)), from the end down.
function stacked(top: Card[]): number[] {
  const deck = buildDeck();
  const values: number[] = [];
  for (let i = deck.length - 1; i > 0; i--) {
    const wanted = top[deck.length - 1 - i];
    const j = wanted ? deck.findIndex((held, index) => index <= i && sameCard(held, wanted)) : i;
    [deck[i], deck[j]] = [deck[j], deck[i]];
    values.push((j + 0.5) / (i + 1));
  }
  return values;
}

// Seats everyone but the last player, then queues the cut for the dealer (each player's card in seat order) and the
// deal's starting card, which the last player's join uses
async function cutAndDeal(seat: Seat, cut: Card[], starter: Card, names: string[]) {
  const table = await seat('uno', names.slice(0, -1));
  await table.random(...stacked(cut), ...stacked([starter]));
  const last = await table.join(names[names.length - 1]);
  return { table, pages: [...table.pages, last] };
}

type Deal = {
  hands: Record<number, Card[]>;
  discard: Card[]; // the top card last
  color?: Color;
  drawPile?: Card[];
  current?: number;
  direction?: 1 | -1;
  scores?: Record<number, number>;
  dealer?: number;
};

// Crafts a round under way
async function deal(table: Table, { hands, discard, color, drawPile = GREENS, current = 1, direction = 1, scores, dealer }: Deal) {
  const seats = Object.keys(hands).map(Number);
  const top = discard[discard.length - 1];
  await table.patch({
    started: true,
    hands,
    discardPile: discard,
    drawPile,
    currentColor: color ?? top.color,
    direction,
    drawnCard: null,
    currentPlayer: current,
    turnHolder: current,
    pendingFour: null,
    pendingDraw: null,
    unoWindow: null,
    revealed: null,
    roundSummary: null,
    lastMove: null,
    scores: scores ?? Object.fromEntries(seats.map(seat => [seat, 0])),
    dealer: dealer ?? seats[seats.length - 1],
    roundNumber: 1
  });
}

async function start(seat: Seat, names = ['Alice', 'Bob', 'Cara'], options?: SeatOptions) {
  const table = await seat('uno', names, options);
  return { table, pages: table.pages };
}

const hand = (page: Page) => page.getByRole('region', { name: 'Your hand' });
const handCard = (page: Page, name: string) => hand(page).getByRole('button', { name, exact: true }).first();
const play = (page: Page, name: string) => handCard(page, name).click();
const player = (page: Page, name: string) => page.locator('.players .player', { hasText: name });
const countOf = (page: Page, name: string) => player(page, name).locator('.player-count');
const discardTop = (page: Page) => page.locator('.piles .pile').nth(1).locator('.card');
const colorName = (page: Page) => page.locator('.color-name');
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.turn-message');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const catchButton = (page: Page) => page.getByRole('button', { name: /^Catch / });
const scoring = (page: Page) => page.getByRole('dialog', { name: 'Round scoring' });

// Plays a Wild from the hand and names `color`
async function playWild(page: Page, name: string, color: Color) {
  await play(page, name);
  await page.getByRole('group', { name: 'Choose a color' }).getByRole('button', { name: color }).click();
}

// The scenarios more than one README section describes
const scenarios = {
  // Each player draws a card for the deal: the highest number deals, a card that is not a number counts lowest,
  // and tied players draw again
  async cutForDealer(seat: Seat) {
    const high = await cutAndDeal(seat, [c('red', '9'), c('red', '3')], c('blue', '5'), ['Alice', 'Bob']);
    await expect(player(high.pages[1], 'Alice').locator('.player-score')).toHaveText('0 pts, dealer');
    await expect(player(high.pages[1], 'Bob').locator('.player-score')).toHaveText('0 pts');

    const action = await cutAndDeal(seat, [c('red', 'skip'), c('red', '0')], c('blue', '5'), ['Alice', 'Bob']);
    await expect(player(action.pages[0], 'Bob').locator('.player-score')).toHaveText('0 pts, dealer');

    const tie = await cutAndDeal(seat, [c('red', '5'), c('blue', '5'), c('red', '2'), c('green', '8')], c('blue', '5'), ['Alice', 'Bob']);
    await expect(player(tie.pages[0], 'Bob').locator('.player-score')).toHaveText('0 pts, dealer');
    return high;
  },

  // Alice deals to Bob and Cara, with `starter` turned up
  dealtByAlice(seat: Seat, starter: Card) {
    return cutAndDeal(seat, [c('red', '9'), c('red', '3'), c('red', '2')], starter, ['Alice', 'Bob', 'Cara']);
  },

  // Alice plays her second-to-last card without calling UNO, and Bob and Cara may catch her
  async uncalled(seat: Seat) {
    const { table, pages } = await start(seat);
    await deal(table, {
      hands: { 1: [c('red', '7'), c('red', '8')], 2: [c('blue', '1'), c('red', '2'), c('blue', '3')], 3: [c('green', '1'), c('green', '2')] },
      discard: [c('red', '5')]
    });
    await play(pages[0], 'red 7');
    return { table, pages };
  },

  // Alice plays a Wild Draw Four on Bob, then Bob leaves and is dismissed
  async fourOnLeaver(seat: Seat) {
    const { table, pages: [alice, bob, cara] } = await start(seat);
    await deal(table, {
      hands: { 1: [FOUR, c('blue', '1'), c('blue', '2')], 2: [c('yellow', '1'), c('yellow', '2'), c('yellow', '3')], 3: [c('blue', '7'), c('green', '2')] },
      discard: [c('red', '5')],
      drawPile: GREENS.slice(0, 4)
    });
    await playWild(alice, 'Wild Draw Four', 'blue');
    await expect(bob.getByRole('group', { name: 'Answer the Wild Draw Four' })).toBeVisible();
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(alice.locator('.players .player')).toHaveCount(2);
    return { table, alice, cara };
  }
};

test.describe('UNO rules', () => {
  test('the deck has the standard 108 cards', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat, ['Alice', 'Bob']);
    const state = await table.state<GameState>();
    const all = [...state.drawPile, ...state.discardPile, ...Object.values(state.hands).flat()];
    expect(all).toHaveLength(108);
    const count = (color: Card['color'], value: Value) => all.filter(held => sameCard(held, c(color, value))).length;
    for (const color of ['red', 'yellow', 'green', 'blue'] as const) {
      expect(count(color, '0')).toBe(1);
      for (const value of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'drawTwo'] as Value[]) expect(count(color, value)).toBe(2);
    }
    expect(count('wild', 'wild')).toBe(4);
    expect(count('wild', 'wildDrawFour')).toBe(4);
    // The page accounts for every card but the top discard
    const shown = Number((await alice.locator('.pile-label').first().textContent())?.replace('Draw pile: ', ''));
    const held = await alice.locator('.player-count').evaluateAll(counts => counts.reduce((sum, element) => sum + parseInt(element.textContent ?? '0'), 0));
    expect(shown + held + 1).toBe(108);
  });

  test('the highest cut deals, everyone gets 7, the top card starts the discards, the dealer\'s left goes first, and the deal passes on', async ({ seat }) => {
    const { pages: [alice, bob] } = await scenarios.cutForDealer(seat);
    await expect(hand(alice).getByRole('button')).toHaveCount(7);
    await expect(countOf(alice, 'Bob')).toHaveText('7 cards');
    await expect(discardTop(alice)).toHaveAttribute('title', 'blue 5');
    // Alice dealt, so Bob, the next seat up, goes first
    await expect(turn(bob)).toHaveText('You go first. Joining closes after the first move.');

    // The deal passes one seat at the end of the round
    const { table, pages } = await start(seat, ['Dan', 'Eve']);
    await deal(table, { hands: { 1: [c('red', '7')], 2: [c('blue', '1')] }, discard: [c('red', '5')], dealer: 2 });
    await expect(player(pages[0], 'Eve').locator('.player-score')).toHaveText('0 pts, dealer');
    await play(pages[0], 'red 7');
    for (const page of pages) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(pages[0].locator('.round')).toHaveText('Round 2: first to 500 points wins');
    await expect(player(pages[0], 'Dan').locator('.player-score')).toHaveText('1 pts, dealer');
  });

  test('a starting card acts as if the dealer played it, and a starting Wild Draw Four is shuffled back', async ({ seat }) => {
    const skip = await scenarios.dealtByAlice(seat, c('red', 'skip'));
    await expect(turn(skip.pages[2])).toHaveText('You go first. Joining closes after the first move.');
    await expect(countOf(skip.pages[2], 'Bob')).toHaveText('7 cards');

    const drawTwo = await scenarios.dealtByAlice(seat, c('red', 'drawTwo'));
    await expect(countOf(drawTwo.pages[2], 'Bob')).toHaveText('9 cards');
    await expect(turn(drawTwo.pages[2])).toHaveText('You go first. Joining closes after the first move.');

    const reverse = await scenarios.dealtByAlice(seat, c('red', 'reverse'));
    await expect(turn(reverse.pages[0])).toHaveText('You go first. Joining closes after the first move.');
    await expect(reverse.pages[0].locator('.direction')).toHaveText('Direction: ← reversed');

    const wild = await scenarios.dealtByAlice(seat, WILD);
    const bob = wild.pages[1];
    await expect(colorName(bob)).toHaveText('any');
    await expect(bob.locator('.hint')).toHaveText('The game starts on a Wild: name the first color');
    await bob.getByRole('group', { name: 'Choose a color' }).getByRole('button', { name: 'green' }).click();
    await expect(colorName(wild.pages[0])).toHaveText('green');
    await expect(status(wild.pages[0])).toHaveText('Bob chose green to start');
    await expect(turn(bob)).toHaveText('Your turn');

    const four = await scenarios.dealtByAlice(seat, FOUR);
    await expect(discardTop(four.pages[0])).not.toHaveAttribute('title', 'Wild Draw Four');
    const state = await four.table.state<GameState>();
    expect([...state.drawPile, ...Object.values(state.hands).flat()].filter(held => sameCard(held, FOUR))).toHaveLength(4);
  });

  test('you play a card matching the top discard by color or by number or symbol, or a Wild and choose the color', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, {
      hands: { 1: [c('red', '7'), c('blue', '5'), c('green', '9'), WILD], 2: [c('blue', 'skip'), c('yellow', '1')], 3: [c('green', '1')] },
      discard: [c('red', '5')]
    });
    await expect(handCard(alice, 'red 7')).toBeEnabled();
    await expect(handCard(alice, 'blue 5')).toBeEnabled();
    await expect(handCard(alice, 'Wild')).toBeEnabled();
    await expect(handCard(alice, 'green 9')).toBeDisabled();
    await play(alice, 'blue 5');
    await expect(discardTop(bob)).toHaveAttribute('title', 'blue 5');
    await expect(colorName(bob)).toHaveText('blue');
    // A symbol matches by color here, and Bob's yellow 1 matches nothing
    await expect(handCard(bob, 'blue Skip')).toBeEnabled();
    await expect(handCard(bob, 'yellow 1')).toBeDisabled();
    await table.patch({ currentPlayer: 1, turnHolder: 1 });
    await playWild(alice, 'Wild', 'yellow');
    await expect(colorName(bob)).toHaveText('yellow');
    await expect(status(bob)).toHaveText('Alice played Wild (yellow)');
  });

  test('instead you may draw one card, and play it at once or pass to keep it; an unplayable draw ends the turn', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat);
    await deal(table, {
      hands: { 1: [c('blue', '1')], 2: [c('blue', '2')], 3: [c('blue', '3')] },
      discard: [c('red', '5')],
      drawPile: [c('green', '1'), c('red', '9'), c('red', '8')]
    });
    await button(alice, 'Draw').click();
    await expect(alice.locator('.hint')).toHaveText('Play the card you drew, or pass to keep it');
    await expect(handCard(alice, 'red 8')).toBeEnabled();
    await expect(handCard(alice, 'blue 1')).toBeDisabled();
    await expect(button(alice, 'Draw')).toBeDisabled();
    await button(alice, 'Pass').click();
    await expect(status(bob)).toHaveText('Alice passed');
    await expect(countOf(bob, 'Alice')).toHaveText('2 cards');

    await button(bob, 'Draw').click();
    await play(bob, 'red 9');
    await expect(discardTop(cara)).toHaveAttribute('title', 'red 9');

    await button(cara, 'Draw').click();
    await expect(status(alice)).toHaveText('Cara drew a card and could not play it');
    await expect(turn(alice)).toHaveText('Your turn');
    await expect(countOf(alice, 'Cara')).toHaveText('2 cards');
  });

  test('Skip skips the next player, Reverse turns play around (a Skip with two players), and Draw Two draws 2 and skips', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat);
    await deal(table, {
      hands: { 1: [c('red', 'skip'), c('red', '1')], 2: [c('red', 'drawTwo'), c('red', '2')], 3: [c('red', 'reverse'), c('red', '3')] },
      discard: [c('red', '5')]
    });
    await play(alice, 'red Skip');
    await expect(status(cara)).toHaveText('Alice played red Skip; Bob is skipped');
    await expect(turn(cara)).toHaveText('Your turn');
    await play(cara, 'red Reverse');
    await expect(cara.locator('.direction')).toHaveText('Direction: ← reversed');
    await expect(turn(bob)).toHaveText('Your turn');
    await play(bob, 'red Draw Two');
    await expect(status(cara)).toHaveText('Bob played red Draw Two; Alice draws 2 and is skipped');
    await expect(countOf(cara, 'Alice')).toHaveText('3 cards');
    await expect(turn(cara)).toHaveText('Your turn');

    const pair = await start(seat, ['Dan', 'Eve']);
    await deal(pair.table, { hands: { 1: [c('red', 'reverse'), c('red', '1')], 2: [c('red', '2')] }, discard: [c('red', '5')] });
    await play(pair.pages[0], 'red Reverse');
    await expect(status(pair.pages[1])).toHaveText('Dan played red Reverse; Eve is skipped');
    await expect(turn(pair.pages[0])).toHaveText('Your turn');
  });

  test('a Wild Draw Four may be played anyway; the next player accepts and draws 4, or challenges and sees the hand alone', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat);
    const hands = { 2: [c('yellow', '1'), c('yellow', '2')], 3: [c('green', '1'), c('green', '2')] };
    const drawPile = [...GREENS, ...GREENS];

    // Alice holds a red card, so it is not allowed, but the game lets her play it
    await deal(table, { hands: { 1: [FOUR, c('red', '3'), c('blue', '1')], ...hands }, discard: [c('red', '5')], drawPile });
    await expect(handCard(alice, 'Wild Draw Four')).toBeEnabled();
    await playWild(alice, 'Wild Draw Four', 'blue');
    await expect(colorName(cara)).toHaveText('blue');
    await expect(status(cara)).toHaveText('Alice played Wild Draw Four (blue); Bob may accept or challenge it');
    await button(bob, 'Challenge').click();
    await expect(status(cara)).toHaveText("Bob challenged Alice's Wild Draw Four and won; Alice draws 4");
    await expect(countOf(cara, 'Alice')).toHaveText('6 cards');
    await expect(turn(bob)).toHaveText('Your turn');
    const shown = bob.getByRole('region', { name: "Alice's hand" });
    await expect(shown.locator('.card')).toHaveCount(2);
    await expect(shown.locator('.card[title="red 3"]')).toBeVisible();
    await expect(cara.getByRole('region', { name: "Alice's hand" })).toHaveCount(0);
    await expect(alice.getByRole('region', { name: "Alice's hand" })).toHaveCount(0);

    // No red card: the challenger draws 6 and loses the turn
    await deal(table, { hands: { 1: [FOUR, c('blue', '1'), c('blue', '2')], ...hands }, discard: [c('red', '5')], drawPile });
    await playWild(alice, 'Wild Draw Four', 'blue');
    await button(bob, 'Challenge').click();
    await expect(status(cara)).toHaveText("Bob challenged Alice's Wild Draw Four and lost; Bob draws 6 and is skipped");
    await expect(countOf(cara, 'Bob')).toHaveText('8 cards');
    await expect(turn(cara)).toHaveText('Your turn');

    // Accepting draws 4 and loses the turn
    await deal(table, { hands: { 1: [FOUR, c('blue', '1'), c('blue', '2')], ...hands }, discard: [c('red', '5')], drawPile });
    await playWild(alice, 'Wild Draw Four', 'blue');
    await button(bob, 'Accept and draw 4').click();
    await expect(status(cara)).toHaveText('Bob accepted the Wild Draw Four, draws 4 and is skipped');
    await expect(countOf(cara, 'Bob')).toHaveText('6 cards');
    await expect(turn(cara)).toHaveText('Your turn');
  });

  test('UNO is called with the second-to-last card, a late call counts until caught, and a caught player draws 2 until the next move', async ({ seat }) => {
    // Called with the play: nothing to catch
    const called = await start(seat);
    await deal(called.table, {
      hands: { 1: [c('red', '7'), c('red', '8')], 2: [c('blue', '1'), c('red', '2')], 3: [c('green', '1')] },
      discard: [c('red', '5')]
    });
    await button(called.pages[0], 'UNO!').click();
    await play(called.pages[0], 'red 7');
    await expect(player(called.pages[1], 'Alice').locator('.uno-badge')).toHaveText('UNO!');
    await expect(catchButton(called.pages[1])).toHaveCount(0);

    // Not called: caught, and draws 2
    const caught = await scenarios.uncalled(seat);
    await catchButton(caught.pages[1]).click();
    await expect(status(caught.pages[2])).toHaveText('Bob caught Alice not calling UNO; Alice draws 2');
    await expect(countOf(caught.pages[2], 'Alice')).toHaveText('3 cards');

    // A late call still counts
    const lateCall = await scenarios.uncalled(seat);
    await expect(catchButton(lateCall.pages[1])).toBeVisible();
    await button(lateCall.pages[0], 'UNO!').click();
    await expect(status(lateCall.pages[1])).toHaveText('Alice called UNO!');
    await expect(catchButton(lateCall.pages[1])).toHaveCount(0);

    // The next player's move closes the window
    const missed = await scenarios.uncalled(seat);
    await play(missed.pages[1], 'red 2');
    await expect(catchButton(missed.pages[2])).toHaveCount(0);
    await expect(countOf(missed.pages[2], 'Alice')).toHaveText('1 card');
  });

  test('going out scores the other hands, after the next player draws for a last Draw Two; Continue deals the next round without waiting for the disconnected; 500 wins', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat);
    await deal(table, {
      hands: { 1: [c('red', 'drawTwo')], 2: [c('blue', '5'), c('yellow', 'skip'), WILD], 3: [c('green', '3')] },
      discard: [c('red', '5')],
      drawPile: [...GREENS, c('red', '9'), c('red', '1')],
      dealer: 3
    });
    await play(alice, 'red Draw Two');
    // Bob draws the 1 and the 9: 5 + 20 + 50 + 1 + 9, and Cara's 3
    const dialog = scoring(bob);
    await expect(dialog.locator('h2')).toHaveText('Round 1 scoring');
    await expect(dialog.locator('.summary-result')).toHaveText('Alice went out and scores 88 points');
    await expect(dialog.locator('.summary-seat', { hasText: 'Alice' })).toContainText('88 pts');
    await expect(dialog.locator('.summary-seat', { hasText: 'Alice' })).toContainText('Went out: +88');
    await expect(dialog.locator('.summary-seat', { hasText: 'Bob' })).toContainText('5 cards left');
    await expect(dialog.locator('.summary-seat', { hasText: 'Cara' })).toContainText('1 card left');

    await leave(cara);
    await scoring(alice).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(alice).locator('.summary-waiting')).toHaveText('Waiting for Bob');
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await expect(status(bob)).toHaveText('Round 2: Alice deals');
    await expect(scoring(bob)).toHaveCount(0);
    await expect(bob.locator('.round')).toHaveText('Round 2: first to 500 points wins');
    await expect(hand(bob).locator('.card')).toHaveCount(7);

    const final = await start(seat, ['Dan', 'Eve']);
    await deal(final.table, { hands: { 1: [c('red', '7')], 2: [WILD] }, discard: [c('red', '5')], scores: { 1: 450, 2: 300 } });
    await play(final.pages[0], 'red 7');
    await expect(scoring(final.pages[1]).locator('h2')).toHaveText('Final scoring');
    await expect(scoring(final.pages[1]).locator('.summary-result')).toHaveText('Dan went out and wins with 500 points!');
    await expect(turn(final.pages[1])).toHaveText('Game over: Dan wins');
  });

  test('when the draw pile runs out, the discards but the top card are shuffled into a new draw pile', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, {
      hands: { 1: [c('green', '9')], 2: [c('yellow', '1')], 3: [c('yellow', '2')] },
      discard: [c('blue', '1'), c('blue', '2'), c('red', '5')],
      drawPile: []
    });
    await expect(bob.getByText('Draw pile: 0')).toBeVisible();
    await button(alice, 'Draw').click();
    await expect(countOf(bob, 'Alice')).toHaveText('2 cards');
    await expect(bob.getByText('Draw pile: 1')).toBeVisible();
    await expect(discardTop(bob)).toHaveAttribute('title', 'red 5');
    await expect(hand(alice).locator('.card[title^="blue"]')).toHaveCount(1);
  });

  test('you see only your own hand and the others\' counts, and the draw pile is hidden', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat);
    await deal(table, {
      hands: { 1: [c('red', '7'), c('green', '9')], 2: [c('blue', '1'), c('blue', '2'), c('blue', '3')], 3: [c('yellow', '4')] },
      discard: [c('yellow', '3')],
      drawPile: [c('red', 'skip')]
    });
    for (const page of [bob, cara]) {
      await expect(countOf(page, 'Alice')).toHaveText('2 cards');
      await expect(page.locator('[title="green 9"]')).toHaveCount(0);
      await expect(page.locator('[title="red 7"]')).toHaveCount(0);
    }
    await expect(countOf(alice, 'Bob')).toHaveText('3 cards');
    await expect(alice.locator('[title="blue 1"]')).toHaveCount(0);
    await expect(alice.locator('.piles .card-back .card-face')).toHaveText('UNO');
    await expect(alice.locator('[title="red Skip"]')).toHaveCount(0);
  });

  test('a dismissed player\'s cards go under the draw pile, their turns are skipped, a Wild Draw Four by or on them is dropped, and the last player wins', async ({ seat }) => {
    const { table, alice, cara } = await scenarios.fourOnLeaver(seat);
    // Bob's three cards went under the draw pile, and his turn passed on to Cara with nothing to answer
    await expect(alice.getByText('Draw pile: 7')).toBeVisible();
    const state = await table.state<GameState>();
    expect(state.drawPile.slice(0, 3)).toEqual([c('yellow', '1'), c('yellow', '2'), c('yellow', '3')]);
    await expect(turn(cara)).toHaveText('Your turn');
    await expect(cara.getByRole('group', { name: 'Answer the Wild Draw Four' })).toHaveCount(0);
    await play(cara, 'blue 7');
    await expect(turn(alice)).toHaveText('Your turn');

    // A Wild Draw Four played by the leaver is dropped too
    const by = await start(seat);
    await deal(by.table, {
      hands: { 1: [c('blue', '1')], 2: [FOUR, c('blue', '2'), c('blue', '3')], 3: [c('blue', '7'), c('green', '2')] },
      discard: [c('red', '5')],
      current: 2
    });
    await playWild(by.pages[1], 'Wild Draw Four', 'blue');
    await expect(by.pages[2].getByRole('group', { name: 'Answer the Wild Draw Four' })).toBeVisible();
    await leave(by.pages[1]);
    await dismiss('Bob', by.pages[0], by.pages[2]);
    await expect(by.pages[2].getByRole('group', { name: 'Answer the Wild Draw Four' })).toHaveCount(0);
    await expect(turn(by.pages[2])).toHaveText('Your turn');
    await expect(countOf(by.pages[2], 'Cara')).toHaveText('2 cards');

    const pair = await start(seat, ['Dan', 'Eve']);
    await deal(pair.table, { hands: { 1: [c('red', '7'), c('red', '8')], 2: [c('blue', '1')] }, discard: [c('red', '5')] });
    await leave(pair.pages[1]);
    await dismiss('Eve', pair.pages[0]);
    await expect(status(pair.pages[0])).toHaveText('Dan wins! Everyone else left.');
  });

  test('an undo needs every player\'s approval, and goes back past UNO calls and catches', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await scenarios.uncalled(seat);
    await catchButton(bob).click();
    await expect(countOf(cara, 'Alice')).toHaveText('3 cards');

    await cara.getByRole('button', { name: 'Undo' }).click();
    await alice.getByRole('button', { name: 'Approve' }).click();
    await bob.getByRole('button', { name: 'Decline' }).click();
    await expect(cara.locator('.undo-vote')).toHaveCount(0);
    await expect(countOf(cara, 'Alice')).toHaveText('3 cards');

    await undo(cara, alice, bob);
    await expect(status(alice)).toHaveText('Last turn undone');
    // Back to before Alice's play, the catch undone with it
    await expect(hand(alice).locator('.card')).toHaveCount(2);
    await expect(handCard(alice, 'red 7')).toBeEnabled();
    await expect(discardTop(alice)).toHaveAttribute('title', 'red 5');
    await expect(turn(alice)).toHaveText('Your turn');
  });

  test('the host can set a lower target', async ({ seat }) => {
    const { table, pages } = await start(seat, ['Dan', 'Eve'], { houseRules: { targetScore: 250 } });
    await expect(pages[0].locator('.round')).toHaveText('Round 1: first to 250 points wins');
    await deal(table, { hands: { 1: [c('red', '7')], 2: [WILD] }, discard: [c('red', '5')], scores: { 1: 200, 2: 100 } });
    await play(pages[0], 'red 7');
    await expect(scoring(pages[1]).locator('h2')).toHaveText('Final scoring');
    await expect(scoring(pages[1]).locator('.summary-target')).toHaveText('First to 250 points wins');
    await expect(scoring(pages[1]).locator('.summary-result')).toHaveText('Dan went out and wins with 250 points!');
    await expect(turn(pages[1])).toHaveText('Game over: Dan wins');
  });

  test('stacking a Draw Two', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, ['Alice', 'Bob', 'Cara'], { houseRules: { stacking: true } });
    await deal(table, {
      hands: { 1: [c('red', 'drawTwo'), c('red', '1')], 2: [c('red', 'drawTwo'), c('red', '2')], 3: [c('green', '1'), c('green', '2')] },
      discard: [c('red', '5')]
    });
    await play(alice, 'red Draw Two');
    await expect(bob.locator('.stack-count')).toHaveText('Stack: Bob draws 2 unless they stack');
    await expect(countOf(bob, 'Bob')).toHaveText('2 cards');
    await expect(bob.getByRole('group', { name: 'Answer the stack' })).toBeVisible();
    await expect(button(bob, 'Draw')).toBeDisabled();
    await play(bob, 'red Draw Two');
    await expect(cara.locator('.stack-count')).toHaveText('Stack: Cara draws 4 unless they stack');
    await expect(handCard(cara, 'green 1')).toBeDisabled();
    await expect(cara.locator('.hint')).toHaveText('Play a Draw Two or Wild Draw Four on it, or accept and draw 4');
    await expect(cara.getByRole('group', { name: 'Answer the stack' })).toContainText('Play a Draw Two or Wild Draw Four on the stack');
    await button(cara, 'Accept and draw 4').click();
    await expect(cara.locator('.stack-count')).toHaveCount(0);
    await expect(countOf(alice, 'Cara')).toHaveText('6 cards');
    await expect(turn(alice)).toHaveText('Your turn');
  });

  test('a Draw Two is not offered on a Wild Draw Four', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob', 'Cara'], { houseRules: { stacking: true } });
    await deal(table, {
      hands: { 1: [FOUR, c('red', '1')], 2: [c('blue', 'drawTwo'), c('blue', '2')], 3: [c('green', '1'), c('green', '2')] },
      discard: [c('red', '5')]
    });
    await playWild(alice, 'Wild Draw Four', 'blue');
    const panel = bob.getByRole('group', { name: 'Answer the Wild Draw Four' });
    await expect(panel).toContainText('Or play a Wild Draw Four on it.');
    await expect(panel).not.toContainText('Draw Two');
    await expect(handCard(bob, 'blue Draw Two')).toBeDisabled();
    await expect(bob.locator('.hint')).toHaveText('Play a Wild Draw Four on it, or accept and draw 4');
  });

  test('a 7 swaps hands', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, ['Alice', 'Bob', 'Cara'], { houseRules: { sevenZero: true } });
    await deal(table, {
      hands: { 1: [c('red', '7'), c('red', '8'), c('red', '9')], 2: [c('blue', '1')], 3: [c('green', '1'), c('green', '2')] },
      discard: [c('red', '5')]
    });
    await play(alice, 'red 7');
    const picker = alice.getByRole('group', { name: 'Swap hands with' });
    await expect(picker.getByRole('button')).toHaveText(['Bob (1)', 'Cara (2)', 'Cancel']);
    await picker.getByRole('button', { name: 'Cara (2)' }).click();
    await expect(status(bob)).toHaveText('Alice played red 7; swaps hands with Cara');
    await expect(countOf(bob, 'Alice')).toHaveText('2 cards');
    await expect(countOf(bob, 'Cara')).toHaveText('2 cards');
    await expect(handCard(alice, 'green 1')).toBeVisible();
    await expect(handCard(cara, 'red 8')).toBeVisible();
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(cara.getByRole('group', { name: 'Swap hands with' })).toHaveCount(0);
  });

  test('a player jumps in out of turn and play continues from them', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, ['Alice', 'Bob', 'Cara'], { houseRules: { jumpIn: true } });
    await deal(table, {
      hands: {
        1: [c('red', '7'), c('red', '8')],
        2: [c('red', '5'), c('red', '6'), c('blue', '5'), c('red', 'skip'), c('green', '1')],
        3: [c('green', '2'), c('green', '3')]
      },
      discard: [c('red', '5')]
    });
    await expect(handCard(bob, 'red 5')).toHaveClass(/card-playable/);
    for (const name of ['red 6', 'blue 5', 'red Skip', 'green 1']) await expect(handCard(bob, name)).toBeDisabled();
    await expect(bob.locator('.hint')).toHaveText('Jump in: you hold a card identical to the top card');
    await expect(handCard(cara, 'green 2')).toBeDisabled();

    await play(bob, 'red 5');
    await expect(status(alice)).toHaveText('Bob jumped in with red 5');
    await expect(turn(cara)).toHaveText('Your turn');
    await expect(turn(alice)).not.toHaveText('Your turn');
    await expect(countOf(alice, 'Bob')).toHaveText('4 cards');
    await expect(discardTop(alice)).toHaveAttribute('title', 'red 5');
    // Alice lost her turn, so her cards are no longer playable
    await expect(handCard(alice, 'red 7')).toBeDisabled();
    await expect(handCard(bob, 'red 5')).toHaveCount(0);

    await undo(bob, alice, cara);
    await expect(turn(alice)).toHaveText('Your turn');
    await expect(countOf(alice, 'Bob')).toHaveText('5 cards');
  });
});

test.describe('UNO controls', () => {
  test('with Color-blind symbols on, every colored card, the current color and the color choices show a shape', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    await deal(table, { hands: { 1: [c('red', '7'), c('blue', '7'), c('green', '7'), c('yellow', '7'), WILD], 2: [c('blue', '1')], 3: [c('blue', '2')] }, discard: [c('red', '5')] });
    await expect(alice.locator('.color-symbol')).toHaveCount(0);
    await setPreference(alice, 'Color-blind symbols', true);
    for (const shape of ['circle', 'square', 'triangle', 'star']) await expect(hand(alice).locator(`.color-symbol-${shape}`)).toHaveCount(1);
    await expect(hand(alice).locator('.color-symbol')).toHaveCount(4);
    await expect(discardTop(alice).locator('.color-symbol-circle')).toHaveCount(1);
    await expect(alice.locator('.color-swatch .color-symbol-circle')).toHaveCount(1);
    await handCard(alice, 'Wild').click();
    await expect(alice.getByRole('group', { name: 'Choose a color' }).locator('.color-symbol')).toHaveCount(4);
  });

  test('the card you drew is outlined until your next move', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    await deal(table, {
      hands: { 1: [c('blue', '1')], 2: [c('blue', '2')], 3: [c('blue', '3')] },
      discard: [c('red', '5')],
      drawPile: [c('green', '1'), c('red', '8')]
    });
    await button(alice, 'Draw').click();
    await expect(hand(alice).locator('.newly-drawn')).toHaveCount(1);
    await expect(hand(alice).locator('.newly-drawn')).toHaveAttribute('title', 'red 8');
    await play(alice, 'red 8');
    await expect(hand(alice).locator('.newly-drawn')).toHaveCount(0);
  });

  test('playable cards in your hand are raised and outlined, and clicking one plays it', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, { hands: { 1: [c('red', '7'), c('green', '9')], 2: [c('blue', '1')], 3: [c('blue', '2')] }, discard: [c('red', '5')] });
    await expect(handCard(alice, 'red 7')).toHaveClass(/card-playable/);
    await expect(handCard(alice, 'green 9')).toHaveClass(/card-unplayable/);
    const [playable, unplayable] = await hand(alice).locator('.card').evaluateAll(cards => cards.map(element => {
      const style = getComputedStyle(element);
      return { outline: style.outlineStyle, transform: style.transform };
    }));
    expect(playable.outline).toBe('solid');
    expect(playable.transform).not.toBe('none');
    expect(unplayable.outline).toBe('none');
    await play(alice, 'red 7');
    await expect(discardTop(bob)).toHaveAttribute('title', 'red 7');
  });

  test('a Wild is played by clicking it and a color, Cancel puts it back, and after a starting Wild the first player gets the colors', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, { hands: { 1: [WILD, c('green', '9')], 2: [c('blue', '1')], 3: [c('blue', '2')] }, discard: [c('red', '5')] });
    await play(alice, 'Wild');
    const picker = alice.getByRole('group', { name: 'Choose a color' });
    await expect(alice.locator('.hint')).toHaveText('Choose a color for your Wild');
    await expect(handCard(alice, 'Wild')).toHaveClass(/card-selected/);
    await picker.getByRole('button', { name: 'Cancel' }).click();
    await expect(picker).toHaveCount(0);
    await expect(hand(alice).locator('.card')).toHaveCount(2);
    await playWild(alice, 'Wild', 'green');
    await expect(colorName(bob)).toHaveText('green');

    // After a starting Wild, no Cancel: the first player must name a color
    await table.patch({ discardPile: [WILD], currentColor: null, currentPlayer: 2, turnHolder: 2, started: true });
    const first = bob.getByRole('group', { name: 'Choose a color' });
    await expect(first.getByRole('button')).toHaveText(['red', 'yellow', 'green', 'blue']);
    await expect(alice.getByRole('group', { name: 'Choose a color' })).toHaveCount(0);
  });

  test('click Draw or the draw pile to draw, then play the highlighted card or Pass to keep it', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, {
      hands: { 1: [c('blue', '1')], 2: [c('blue', '2')], 3: [c('blue', '3')] },
      discard: [c('red', '5')],
      drawPile: [c('green', '1'), c('red', '9'), c('red', '8')]
    });
    await alice.getByRole('button', { name: 'Draw a card' }).click();
    await expect(handCard(alice, 'red 8')).toHaveClass(/card-playable/);
    await expect(hand(alice).locator('.card-playable')).toHaveCount(1);
    await expect(alice.getByRole('button', { name: 'Draw a card' })).toHaveCount(0);
    await button(alice, 'Pass').click();
    await expect(turn(bob)).toHaveText('Your turn');
    await button(bob, 'Draw').click();
    await play(bob, 'red 9');
    await expect(discardTop(alice)).toHaveAttribute('title', 'red 9');
  });

  test('UNO! with two cards stays pressed until you play, can be clicked right after, and Catch shows for everyone else until the next move', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    await deal(table, {
      hands: { 1: [c('red', '7'), c('red', '8')], 2: [c('blue', '1'), c('red', '2')], 3: [c('green', '1')] },
      discard: [c('red', '5')]
    });
    await expect(alice.locator('.hint')).toHaveText('Call UNO before you play your next-to-last card');
    await button(alice, 'UNO!').click();
    await expect(button(alice, 'UNO!')).toHaveAttribute('aria-pressed', 'true');
    await expect(alice.locator('.hint')).toHaveText('UNO! Now play your next-to-last card');
    await play(alice, 'red 7');
    await expect(button(alice, 'UNO!')).toHaveAttribute('aria-pressed', 'false');
    await expect(button(alice, 'UNO!')).toBeDisabled();

    const forgot = await scenarios.uncalled(seat);
    await expect(forgot.pages[0].locator('.hint')).toHaveText('Call UNO before anyone catches you!');
    await expect(button(forgot.pages[0], 'UNO!')).toBeEnabled();
    for (const page of forgot.pages.slice(1)) await expect(catchButton(page)).toHaveText('Catch Alice: no UNO call!');
    await expect(catchButton(forgot.pages[0])).toHaveCount(0);
    await play(forgot.pages[1], 'red 2');
    for (const page of forgot.pages) await expect(catchButton(page)).toHaveCount(0);
  });

  test('a Wild Draw Four on you offers Challenge or Accept and draw 4, and a challenged hand shows below the table until your next move', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat);
    await deal(table, {
      hands: { 1: [FOUR, c('red', '3'), c('blue', '1')], 2: [c('blue', '9'), c('yellow', '2')], 3: [c('green', '1')] },
      discard: [c('red', '5')]
    });
    await playWild(alice, 'Wild Draw Four', 'blue');
    const answer = bob.getByRole('group', { name: 'Answer the Wild Draw Four' });
    await expect(answer.getByRole('button')).toHaveText(['Challenge', 'Accept and draw 4']);
    await expect(cara.getByRole('group', { name: 'Answer the Wild Draw Four' })).toHaveCount(0);
    await answer.getByRole('button', { name: 'Challenge' }).click();
    const shown = bob.getByRole('region', { name: "Alice's hand" });
    await expect(shown).toContainText('only you see this');
    // Below the table
    const [tableBottom, shownTop] = await bob.evaluate(() => [
      document.querySelector('.table')!.getBoundingClientRect().bottom,
      document.querySelector('.revealed')!.getBoundingClientRect().top
    ]);
    expect(shownTop).toBeGreaterThanOrEqual(tableBottom);
    await play(bob, 'blue 9');
    await expect(shown).toHaveCount(0);
  });

  test('the table shows the round, counts and scores in seat order, the dealer, the direction, the top discard and color, and outlines the current player', async ({ seat }) => {
    const { table, pages: [, , cara] } = await start(seat);
    await deal(table, {
      hands: { 1: [c('red', '7'), c('red', '8')], 2: [c('blue', '1')], 3: [c('green', '1'), c('green', '2'), c('green', '3')] },
      discard: [c('red', '5')],
      scores: { 1: 120, 2: 0, 3: 45 },
      dealer: 2,
      direction: -1
    });
    await expect(cara.locator('.round')).toHaveText('Round 1: first to 500 points wins');
    await expect(cara.locator('.players .player-name')).toHaveText(['Alice', 'Bob', 'Cara (you)']);
    await expect(cara.locator('.players .player-count')).toHaveText(['2 cards', '1 card', '3 cards']);
    await expect(cara.locator('.players .player-score')).toHaveText(['120 pts', '0 pts, dealer', '45 pts']);
    await expect(cara.locator('.direction-arrow')).toHaveText('←');
    await expect(discardTop(cara)).toHaveAttribute('title', 'red 5');
    await expect(colorName(cara)).toHaveText('red');
    await expect(player(cara, 'Alice')).toHaveClass(/player-current/);
    await expect(player(cara, 'Bob')).not.toHaveClass(/player-current/);
    await table.patch({ direction: 1 });
    await expect(cara.locator('.direction')).toHaveText('Direction: → in seat order');
  });

  test('after a round read the scoring and click Continue; after the last round click Close, and Show Scoring opens it again', async ({ seat }) => {
    const round = await start(seat, ['Alice', 'Bob']);
    await deal(round.table, { hands: { 1: [c('red', '7')], 2: [c('blue', '1')] }, discard: [c('red', '5')] });
    await play(round.pages[0], 'red 7');
    await expect(scoring(round.pages[1]).locator('.summary-target')).toHaveText('First to 500 points wins');
    await scoring(round.pages[1]).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(round.pages[1]).locator('.summary-waiting')).toHaveText('Waiting for Alice');
    await expect(turn(round.pages[0])).toHaveText('Round 1 is over');

    const final = await start(seat, ['Dan', 'Eve']);
    await deal(final.table, { hands: { 1: [c('red', '7')], 2: [WILD] }, discard: [c('red', '5')], scores: { 1: 480, 2: 0 } });
    await play(final.pages[0], 'red 7');
    const dialog = scoring(final.pages[1]);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
    await button(final.pages[1], 'Show Scoring').click();
    await expect(dialog.locator('h2')).toHaveText('Final scoring');
  });

  test('the cards a round-ending Draw Two made you take are not outlined again in the next round', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    const [one, two] = [c('red', '1'), c('red', '2')];
    await deal(table, { hands: { 1: [c('blue', '9')], 2: [c('red', 'drawTwo')] }, discard: [c('red', '5')], drawPile: [FOUR, FOUR], current: 2 });
    await play(bob, 'red Draw Two');
    await expect(hand(alice).locator('.newly-drawn')).toHaveCount(2);
    // The queued shuffle deals Alice red 1 and red 2 among her new cards; Continue deals without a move
    await table.random(...stacked([one, one, two, two]));
    await scoring(alice).getByRole('button', { name: 'Continue' }).click();
    await scoring(bob).getByRole('button', { name: 'Continue' }).click();
    await expect(hand(alice).getByRole('button')).toHaveCount(7);
    await expect(hand(alice).locator('.newly-drawn')).toHaveCount(0);
  });

  test('clicking Undo asks everyone to undo the last move', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat);
    await deal(table, { hands: { 1: [c('red', '7'), c('red', '8')], 2: [c('blue', '1')], 3: [c('green', '1')] }, discard: [c('red', '5')] });
    await expect(alice.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await play(alice, 'red 8');
    await alice.getByRole('button', { name: 'Undo' }).click();
    for (const page of [bob, cara]) await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, ['Alice', 'Bob']);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('Wild Draw Four');
    await expect(faq).toContainText('How do I call UNO?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('UNO differences from Wikipedia', () => {
  test('with house rules off there is no stacking a Draw Two, and no jumping in out of turn', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat);
    await deal(table, {
      hands: { 1: [c('red', 'drawTwo'), c('red', '1')], 2: [c('red', 'drawTwo'), c('red', '2')], 3: [c('red', 'drawTwo'), c('green', '1')] },
      discard: [c('red', '5')]
    });
    // Cara holds the same card but cannot jump in on Alice's turn
    await expect(handCard(cara, 'red Draw Two')).toBeDisabled();
    await play(alice, 'red Draw Two');
    // Bob draws at once and cannot stack his own Draw Two
    await expect(countOf(cara, 'Bob')).toHaveText('4 cards');
    await expect(turn(cara)).toHaveText('Your turn');
    await expect(turn(bob)).toHaveText("Cara's turn");
  });

  test('the classic rules are kept: play goes on to 500 points, and starting cards take effect', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob']);
    await deal(table, { hands: { 1: [c('red', '7')], 2: [c('blue', '1')] }, discard: [c('red', '5')] });
    await play(alice, 'red 7');
    await expect(scoring(bob).locator('h2')).toHaveText('Round 1 scoring');
    await expect(scoring(bob).getByRole('button', { name: 'Continue' })).toBeVisible();
    await expect(turn(bob)).toHaveText('Round 1 is over');

    const skip = await scenarios.dealtByAlice(seat, c('red', 'skip'));
    await expect(turn(skip.pages[2])).toHaveText('You go first. Joining closes after the first move.');
  });

  test('cutting for the dealer: a card that is not a number counts lowest, and tied players draw again', async ({ seat }) => {
    await scenarios.cutForDealer(seat);
  });

  test('UNO is a button, and the catch window closes when any move is made', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await scenarios.uncalled(seat);
    await expect(button(alice, 'UNO!')).toBeEnabled();
    await expect(catchButton(cara)).toBeVisible();
    await button(bob, 'Draw').click();
    await expect(catchButton(cara)).toHaveCount(0);
    await expect(button(alice, 'UNO!')).toBeDisabled();
  });

  test('a leaver\'s cards go under the draw pile, and a Wild Draw Four played on them is dropped', async ({ seat }) => {
    const { table, cara } = await scenarios.fourOnLeaver(seat);
    const state = await table.state<GameState>();
    expect(state.drawPile.slice(0, 3)).toEqual([c('yellow', '1'), c('yellow', '2'), c('yellow', '3')]);
    expect(state.pendingFour).toBeNull();
    await expect(cara.getByRole('group', { name: 'Answer the Wild Draw Four' })).toHaveCount(0);
  });
});

test.describe('UNO house rules', () => {
  test('10 players can join with Most players raised', async ({ seat }) => {
    const names = Array.from({ length: 10 }, (_, index) => `Player${index + 1}`);
    const table = await seat('uno', names, { maxPlayers: 10 });
    expect(table.pages).toHaveLength(10);
    expect((await table.state<{ activePlayers: number[] }>()).activePlayers).toHaveLength(10);
    for (const page of table.pages) await expect(page.getByText('Game is full')).toHaveCount(0);
  });
});
