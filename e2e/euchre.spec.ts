import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, test, undo, type Seat, type SeatOptions, type Table } from './fixtures.ts';
import type { Card, GameState, Suit, TeamScores } from '../games/euchre/types.ts';

// One test per rule and control in games/euchre/README.md. Seats join in order: Alice 1, Bob 2, Cara 3, Dan 4, so
// Alice and Cara are one team and Bob and Dan the other. Seat 4 deals first, so Alice speaks and leads first.

const c = (suit: Suit, rank: Card['rank']): Card => ({ suit, rank });
const H = (rank: Card['rank']) => c('hearts', rank);
const D = (rank: Card['rank']) => c('diamonds', rank);
const S = (rank: Card['rank']) => c('spades', rank);
const C = (rank: Card['rank']) => c('clubs', rank);
const NAMES: Record<string, string> = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' };
const label = (card: Card) => `${NAMES[card.rank] ?? card.rank} of ${card.suit}`;
const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];

async function start(seat: Seat, options?: SeatOptions): Promise<{ table: Table; pages: Page[] }> {
  const table = await seat('euchre', ['Alice', 'Bob', 'Cara', 'Dan'], options);
  return { table, pages: table.pages };
}

// A hand under way: Dan dealt, Alice ordered up hearts, Dan discarded, and Alice leads
async function playing(table: Table, hands: Record<number, Card[]>, fields: Partial<GameState> = {}): Promise<void> {
  await table.patch({
    started: true,
    phase: 'play',
    dealer: 4,
    currentPlayer: 1,
    hands,
    upcard: H('9'),
    kitty: [C('10'), D('9'), D('10')],
    discard: S('Q'),
    passed: [],
    maker: 1,
    trump: 'hearts',
    alone: false,
    trick: [],
    lastTrick: null,
    tricksWon: [0, 0],
    roundSummary: null,
    lastMove: null,
    ...fields
  });
}

// The last trick of a hand: Alice's ace of trump takes it. Alice and Cara had `before[0]` tricks, Bob and Dan `before[1]`.
async function lastTrick(table: Table, before: TeamScores, fields: Partial<GameState> = {}): Promise<void> {
  await playing(table, { 1: [H('A')], 2: [S('9')], 3: [S('10')], 4: [C('9')] }, { tricksWon: before, ...fields });
}

async function playLastTrick(pages: Page[], alone = false): Promise<void> {
  const cards = [H('A'), S('9'), S('10'), C('9')];
  for (const [index, page] of pages.entries()) if (!(alone && index === 2)) await handCard(page, cards[index]).click();
}

const hand = (page: Page) => page.getByRole('region', { name: 'Your hand' });
const handCard = (page: Page, card: Card) => hand(page).getByRole('button', { name: label(card), exact: true });
const position = (page: Page, where: 'bottom' | 'left' | 'top' | 'right') => page.locator(`.seats .seat-${where}`);
const seatOf = (page: Page, name: string) => page.locator('.seats .seat').filter({ hasText: name });
const turn = (page: Page) => page.locator('.turn-message');
const status = (page: Page) => page.locator('.game-status');
const hint = (page: Page) => page.locator('.hint');
const scoring = (page: Page) => page.getByRole('dialog', { name: 'Hand scoring' });
const team = (page: Page, which: 0 | 1) => page.locator(`.scoreboard .team-${which}`);
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const suitPicker = (page: Page) => page.getByRole('group', { name: 'Name trump' });
const kitty = (page: Page) => page.locator('.trick .kitty');

async function upcardOf(table: Table): Promise<Card> {
  const upcard = (await table.state<GameState>()).upcard;
  if (!upcard) throw new Error('no upcard');
  return upcard;
}

async function passAll(pages: Page[]): Promise<void> {
  for (const page of pages) await button(page, 'Pass').click();
}

test.describe('Euchre rules', () => {
  test('two partnerships with partners across: seats 1 and 3 against seats 2 and 4', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat);
    await expect(team(alice, 0).locator('.team-names')).toHaveText('Alice and Cara (you)');
    await expect(team(alice, 1).locator('.team-names')).toHaveText('Bob and Dan');
    await expect(team(bob, 1).locator('.team-names')).toHaveText('Bob and Dan (you)');
    await expect(position(alice, 'top').locator('.seat-name')).toHaveText('Cara (partner)');
    await expect(position(bob, 'top').locator('.seat-name')).toHaveText('Dan (partner)');
  });

  test('the deck is 24 cards, 9 to ace in each suit', async ({ seat }) => {
    const { table, pages } = await start(seat);
    for (const page of pages) await expect(hand(page).getByRole('button')).toHaveCount(5);
    const state = await table.state<GameState>();
    const cards = [...Object.values(state.hands).flat(), ...state.kitty, await upcardOf(table)].map(label);
    expect(new Set(cards).size).toBe(24);
    for (const suit of SUITS) {
      for (const rank of ['9', '10', 'J', 'Q', 'K', 'A'] as Card['rank'][]) expect(cards).toContain(label(c(suit, rank)));
    }
  });

  test('seat 4 deals first, five cards each, one turned up and three in the kitty, and the deal passes left after each hand', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob] = pages;
    await expect(seatOf(alice, 'Dan')).toContainText('5 cards, dealer');
    for (const name of ['Alice', 'Bob', 'Cara']) await expect(seatOf(alice, name).locator('.seat-count')).toHaveText('5 cards');
    const upcard = await upcardOf(table);
    await expect(kitty(alice).getByLabel(label(upcard), { exact: true })).toBeVisible();
    await expect(kitty(alice).locator('.kitty-label')).toHaveText('Turned up');
    expect((await table.state<GameState>()).kitty).toHaveLength(3);

    await lastTrick(table, [2, 2]);
    await playLastTrick(pages);
    for (const page of pages) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(status(alice)).toHaveText('Hand 2: Alice deals');
    await expect(seatOf(bob, 'Alice').locator('.seat-count')).toHaveText('5 cards, dealer');
    await expect(turn(bob)).toHaveText('Your turn'); // left of the new dealer speaks first
  });

  test('first round: from the dealer\'s left each player orders up or passes; the dealer may pick it up, takes the turned card and discards one', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    const upcard = await upcardOf(table);
    await expect(turn(alice)).toHaveText(/^Your turn/);
    await button(alice, 'Pass').click();
    await expect(seatOf(bob, 'Alice').locator('.seat-note')).toHaveText('passed');
    await button(bob, 'Pass').click();
    await button(cara, 'Pass').click();
    await expect(button(dan, 'Pick up')).toBeVisible();
    await button(dan, 'Pick up').click();
    await expect(status(alice)).toHaveText(`Dan picked up the ${label(upcard)}`);
    await button(dan, 'Play with partner').click();
    await expect(hand(dan).getByRole('button')).toHaveCount(6);
    await expect(handCard(dan, upcard)).toBeVisible();
    await expect(seatOf(alice, 'Dan').locator('.seat-count')).toHaveText('6 cards, dealer');
    await hand(dan).getByRole('button').first().click();
    await expect(hand(dan).getByRole('button')).toHaveCount(5);
    await expect(status(alice)).toHaveText('Dan discarded a card');
    await expect(alice.locator('.hand-info .suit-name')).toHaveText(upcard.suit);
    await expect(turn(alice)).toHaveText('Your turn');
  });

  test('second round: after four passes the card is turned down and any other suit may be named; four more passes throw the hand in', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob] = pages;
    const upcard = await upcardOf(table);
    await passAll(pages);
    await expect(status(alice)).toHaveText('Dan passed. The turned card is turned down');
    await expect(kitty(alice).locator('.kitty-label')).toHaveText(`The ${label(upcard)} was turned down`);
    const others = SUITS.filter(suit => suit !== upcard.suit);
    await expect(suitPicker(alice).getByRole('button')).toHaveText(others.map(suit => new RegExp(suit)));
    await expect(button(alice, 'Order up')).toHaveCount(0);
    await button(alice, 'Pass').click();
    await suitPicker(bob).getByRole('button', { name: new RegExp(others[0]) }).click();
    await expect(status(alice)).toHaveText(`Bob named ${others[0]} trump`);

    const none = await start(seat);
    await passAll(none.pages);
    await passAll(none.pages);
    await expect(status(none.pages[0])).toHaveText('Dan passed. Everyone passed twice, so Alice deals again');
    await expect(seatOf(none.pages[0], 'Alice').locator('.seat-count')).toHaveText('5 cards, dealer');
    await expect(turn(none.pages[1])).toHaveText('Your turn');
  });

  test('the maker may go alone: their partner sits out and tricks have three cards', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await button(alice, 'Order up').click();
    await button(alice, 'Go alone').click();
    await expect(status(bob)).toHaveText('Alice goes alone; Cara sits out');
    await expect(seatOf(bob, 'Cara').locator('.seat-note')).toHaveText('sits out');
    await expect(seatOf(bob, 'Alice').locator('.seat-note')).toHaveText('maker, alone');

    await playing(table, { 1: [S('9'), S('A')], 2: [S('10'), C('9')], 3: [S('K'), C('10')], 4: [S('Q'), C('Q')] }, { alone: true });
    await expect(hint(cara)).toHaveText('Your partner is going alone: you sit out this hand');
    await handCard(alice, S('9')).click();
    await handCard(bob, S('10')).click();
    await expect(turn(dan)).toHaveText('Your turn');
    await expect(handCard(cara, S('K'))).toBeDisabled();
    await handCard(dan, S('Q')).click();
    await expect(alice.locator('.trick-taken')).toHaveText('Dan took the trick');
    await expect(alice.locator('.trick .playing-card')).toHaveCount(3);
  });

  test('the right bower is highest and the left bower next; the left bower counts as trump, not its own suit', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await playing(table, { 1: [D('A'), S('10')], 2: [D('9'), D('J')], 3: [D('K'), H('A')], 4: [H('J'), S('9')] });
    await handCard(alice, D('A')).click();
    // Diamonds led: the jack of diamonds is a heart now, so Bob must play his 9
    await expect(handCard(bob, D('J'))).toBeDisabled();
    await handCard(bob, D('9')).click();
    await handCard(cara, D('K')).click();
    await handCard(dan, H('J')).click();
    await expect(alice.locator('.trick-taken')).toHaveText('Dan took the trick');
    await handCard(dan, S('9')).click();
    await handCard(alice, S('10')).click();
    // Bob has no spades, so the left bower may trump, and it beats the ace of trump
    await handCard(bob, D('J')).click();
    await handCard(cara, H('A')).click();
    await expect(alice.locator('.trick-taken')).toHaveText('Bob took the trick');
  });

  test('left of the dealer leads, players follow suit if they can or else play anything, the highest trump or else the highest of the suit led takes it, and its winner leads next', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await playing(table, { 1: [S('9'), C('9')], 2: [S('A'), C('10')], 3: [S('10'), C('J')], 4: [D('9'), H('9')] });
    await expect(hint(alice)).toHaveText('Lead any card');
    await handCard(alice, S('9')).click();
    await expect(handCard(bob, C('10'))).toBeDisabled();
    await handCard(bob, S('A')).click();
    await handCard(cara, S('10')).click();
    await expect(handCard(dan, D('9'))).toBeEnabled();
    await handCard(dan, H('9')).click();
    await expect(alice.locator('.trick-taken')).toHaveText('Dan took the trick');
    await expect(turn(dan)).toHaveText('Your turn');
    await expect(hint(dan)).toHaveText('Lead any card');
  });

  test('makers taking 3 or 4 tricks score 1, and the next hand waits for every connected player to Continue', async ({ seat }) => {
    const made = await start(seat);
    await lastTrick(made.table, [2, 2]);
    await playLastTrick(made.pages);
    const [alice, bob, cara, dan] = made.pages;
    await expect(status(alice)).toHaveText('Alice and Cara made it with 3 tricks: 1 point');
    await expect(scoring(alice).locator('.summary-team').nth(0)).toContainText('3 tricks: +1');
    await expect(scoring(alice).locator('.summary-team').nth(1)).toContainText('2 tricks: +0');
    await scoring(alice).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(alice).locator('.summary-waiting')).toHaveText('Waiting for Bob, Cara, Dan');
    await scoring(bob).getByRole('button', { name: 'Continue' }).click();
    await scoring(cara).getByRole('button', { name: 'Continue' }).click();
    await expect(alice.locator('.hand-info')).toContainText('Hand 1');
    await leave(dan);
    await expect(alice.locator('.hand-info')).toContainText('Hand 2, first to 10');
  });

  test('a march scores 2, a lone march 4, and euchred makers give the defenders 2', async ({ seat }) => {
    const march = await start(seat);
    await lastTrick(march.table, [4, 0]);
    await playLastTrick(march.pages);
    await expect(status(march.pages[0])).toHaveText('Alice and Cara took all 5 tricks: a march, 2 points');
    await expect(team(march.pages[0], 0).locator('.team-score')).toHaveText('2');

    const lone = await start(seat);
    await lastTrick(lone.table, [4, 0], { alone: true });
    await playLastTrick(lone.pages, true);
    await expect(status(lone.pages[0])).toHaveText('Alice took all 5 tricks alone: a march, 4 points');
    await expect(scoring(lone.pages[0]).locator('.summary-detail')).toHaveText('Alice made trump and went alone.');

    const euchred = await start(seat);
    await lastTrick(euchred.table, [1, 3]);
    await playLastTrick(euchred.pages);
    await expect(status(euchred.pages[0])).toHaveText('Alice and Cara were euchred: Bob and Dan score 2');
    await expect(team(euchred.pages[0], 1).locator('.team-score')).toHaveText('2');
  });

  test('the first team to 10 wins', async ({ seat }) => {
    const { table, pages } = await start(seat);
    await lastTrick(table, [4, 0], { scores: [8, 9] });
    await playLastTrick(pages);
    await expect(status(pages[1])).toHaveText('Alice and Cara took all 5 tricks: a march, 2 points. Alice and Cara win with 10 points!');
    await expect(turn(pages[1])).toHaveText('Game over');
    await expect(team(pages[1], 0)).toHaveClass(/team-winner/);
  });

  test('you see only your own hand and the card counts; the kitty stays hidden but the turned card, and only the dealer sees the discard', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    const state = await table.state<GameState>();
    for (const card of state.hands[1]) await expect(handCard(alice, card)).toBeVisible();
    for (const card of [...state.hands[2], ...state.hands[3], ...state.hands[4], ...state.kitty]) {
      await expect(alice.getByLabel(label(card), { exact: true })).toHaveCount(0);
    }
    await button(alice, 'Order up').click();
    await button(alice, 'Play with partner').click();
    const discarded = (await table.state<GameState>()).hands[4][0];
    await handCard(dan, discarded).click();
    await expect(dan.locator('.discards').getByLabel(label(discarded), { exact: true })).toBeVisible();
    for (const page of [alice, bob, cara]) {
      await expect(page.locator('.discards')).toHaveCount(0);
      await expect(page.getByLabel(label(discarded), { exact: true })).toHaveCount(0);
    }
  });

  test('a disconnected player keeps their seat and the game waits on their turn; a dismissed player breaks the partnership and the other team wins', async ({ seat }) => {
    const { pages: [alice, bob, cara, dan] } = await start(seat);
    await button(alice, 'Pass').click();
    await leave(bob);
    await expect(alice.getByText('Waiting for Bob to reconnect')).toBeVisible();
    await expect(turn(alice)).toHaveText("Bob's turn");
    await dismiss('Bob', alice, cara, dan);
    await expect(status(alice)).toHaveText('Bob left, so the partnership is broken: Alice and Cara win');
    await expect(turn(cara)).toHaveText('Game over');
  });

  test('an undo needs every connected player, only while all four seats are filled, and goes back past Continue', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara, dan] = pages;
    await lastTrick(table, [2, 2]);
    await playLastTrick(pages);
    for (const page of pages) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(alice.locator('.hand-info')).toContainText('Hand 2');
    await undo(alice, bob, cara, dan);
    await expect(alice.locator('.hand-info')).toContainText('Hand 1');
    await expect(handCard(dan, C('9'))).toBeEnabled();

    await leave(bob);
    await expect(alice.getByText('Bob (disconnected)')).toBeVisible();
    await undo(alice, cara, dan);
    await expect(handCard(cara, S('10'))).toBeEnabled();

    await dismiss('Bob', alice, cara, dan);
    await expect(turn(alice)).toHaveText('Game over');
    await expect(button(alice, 'Undo')).toBeDisabled();
  });

  test('the host can set a lower target', async ({ seat }) => {
    const { table, pages } = await start(seat, { houseRules: { targetScore: 5 } });
    await lastTrick(table, [4, 0], { scores: [3, 0] });
    await playLastTrick(pages);
    await expect(status(pages[1])).toHaveText('Alice and Cara took all 5 tricks: a march, 2 points. Alice and Cara win with 5 points!');
    await expect(scoring(pages[1]).locator('.summary-target')).toHaveText('First to 5 points wins');
    await expect(turn(pages[1])).toHaveText('Game over');
  });
});

test.describe('Euchre controls', () => {
  test('in the first round click Order up (Pick up for the dealer) or Pass; in the second click a suit or Pass', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara, dan] = pages;
    await expect(button(bob, 'Order up')).toHaveCount(0);
    await expect(alice.locator('.action-buttons button')).toHaveText(['Order up', 'Pass', 'Undo']);
    await button(alice, 'Pass').click();
    await button(bob, 'Pass').click();
    await button(cara, 'Pass').click();
    await expect(dan.locator('.action-buttons button')).toHaveText(['Pick up', 'Pass', 'Undo']);
    await button(dan, 'Pass').click();
    const upcard = await upcardOf(table);
    const suit = SUITS.find(other => other !== upcard.suit) ?? 'clubs';
    await expect(alice.locator('.action-buttons button')).toHaveText(['Pass', 'Undo']);
    await suitPicker(alice).getByRole('button', { name: new RegExp(suit) }).click();
    await expect(status(alice)).toHaveText(`Alice named ${suit} trump`);
  });

  test('the maker clicks Go alone or Play with partner', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat);
    await button(alice, 'Order up').click();
    await expect(button(bob, 'Go alone')).toHaveCount(0);
    await expect(alice.locator('.action-buttons button')).toHaveText(['Go alone', 'Play with partner', 'Undo']);
    await button(alice, 'Play with partner').click();
    await expect(status(alice)).toHaveText('Alice plays with their partner');
  });

  test('the dealer clicks a card in their hand to discard it', async ({ seat }) => {
    const { table, pages: [alice, , , dan] } = await start(seat);
    const upcard = await upcardOf(table);
    await button(alice, 'Order up').click();
    await button(alice, 'Play with partner').click();
    await expect(hint(dan)).toHaveText(`The ${label(upcard)} is in your hand: click a card to discard it`);
    for (const card of await hand(dan).getByRole('button').all()) await expect(card).toBeEnabled();
    await expect(hand(alice).getByRole('button').first()).toBeDisabled();
    await hand(dan).getByRole('button').nth(2).click();
    await expect(hand(dan).getByRole('button')).toHaveCount(5);
  });

  test('in a trick the cards you may play are raised and outlined, and clicking one plays it; trump sits at the right of your hand', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await playing(table, { 1: [S('9')], 2: [D('J'), S('10'), C('9')], 3: [S('K')], 4: [S('Q')] });
    await expect(hand(bob).getByRole('button')).toHaveText([/9♣/, /10♠/, /J♦/]); // the left bower sorted among the hearts
    await handCard(alice, S('9')).click();
    await expect(handCard(bob, C('9'))).toBeDisabled();
    const look = await handCard(bob, S('10')).evaluate(element => [getComputedStyle(element).outlineStyle, getComputedStyle(element).transform]);
    expect(look[0]).toBe('solid');
    expect(look[1]).not.toBe('none');
    await handCard(bob, S('10')).click();
    await expect(alice.locator('.trick-left').getByLabel('10 of spades')).toBeVisible();
  });

  test('the table shows scores, tricks, hand number, trump and the maker, the seats with you at the bottom and your partner across, with counts, dealer and notes, and in the middle the turned card, the trick or the last trick taken', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await expect(team(alice, 0).locator('.team-score')).toHaveText('0');
    await expect(team(alice, 0).locator('.team-tricks')).toHaveText('0 tricks');
    await expect(alice.locator('.hand-info')).toContainText('Hand 1, first to 10');
    await expect(alice.locator('.hand-info')).toContainText('Trump: not made yet');
    await expect(position(alice, 'bottom').locator('.seat-name')).toHaveText('Alice (you)');
    await expect(position(alice, 'left').locator('.seat-name')).toHaveText('Bob');
    await expect(position(alice, 'top').locator('.seat-name')).toHaveText('Cara (partner)');
    await expect(position(alice, 'right').locator('.seat-name')).toHaveText('Dan');
    await expect(position(alice, 'right').locator('.seat-count')).toHaveText('5 cards, dealer');
    await expect(kitty(alice).locator('.kitty-label')).toHaveText('Turned up');

    await playing(table, { 1: [S('9'), C('9')], 2: [S('A'), C('10')], 3: [S('10'), C('J')], 4: [S('K'), C('Q')] });
    await expect(alice.locator('.hand-info .maker-info')).toHaveText('Made by Alice');
    await expect(alice.locator('.hand-info .suit-name')).toHaveText('hearts');
    await expect(position(bob, 'right').locator('.seat-note')).toHaveText('maker');
    await handCard(alice, S('9')).click();
    await expect(bob.locator('.trick-right').getByLabel('9 of spades')).toBeVisible();
    await handCard(bob, S('A')).click();
    await handCard(cara, S('10')).click();
    await handCard(dan, S('K')).click();
    await expect(alice.locator('.trick-taken')).toHaveText('Bob took the trick');
    await expect(alice.locator('.trick .playing-card')).toHaveCount(4);
    await expect(team(alice, 1).locator('.team-tricks')).toHaveText('1 trick');
  });

  test('the dealer sees the card they discarded below their hand', async ({ seat }) => {
    const { table, pages: [alice, , , dan] } = await start(seat);
    await button(alice, 'Order up').click();
    await button(alice, 'Play with partner').click();
    const discarded = (await table.state<GameState>()).hands[4][1];
    await handCard(dan, discarded).click();
    const below = dan.locator('.hand .discards');
    await expect(below.locator('.discards-label')).toHaveText('You discarded (only you see it):');
    await expect(below.getByLabel(label(discarded), { exact: true })).toBeVisible();
  });

  test('after a hand click Continue on the scoring screen; after the last hand click Close, and Show Scoring opens it again', async ({ seat }) => {
    const { table, pages } = await start(seat);
    await lastTrick(table, [2, 2]);
    await playLastTrick(pages);
    await expect(scoring(pages[0]).locator('h2')).toHaveText('Hand 1 scoring');
    for (const page of pages) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(pages[0])).toHaveCount(0);

    const final = await start(seat);
    const alice = final.pages[0];
    await lastTrick(final.table, [2, 2], { scores: [9, 0] });
    await playLastTrick(final.pages);
    await expect(scoring(alice).locator('h2')).toHaveText('Final scoring');
    await expect(scoring(alice).getByRole('button', { name: 'Continue' })).toHaveCount(0);
    await scoring(alice).getByRole('button', { name: 'Close' }).click();
    await expect(scoring(alice)).toHaveCount(0);
    await button(alice, 'Show Scoring').click();
    await expect(scoring(alice)).toContainText('Alice and Cara win with 10 points!');
  });

  test('clicking Undo asks everyone to undo the last move', async ({ seat }) => {
    const { pages: [alice, bob, cara, dan] } = await start(seat);
    await button(alice, 'Pass').click();
    await button(alice, 'Undo').click();
    for (const page of [bob, cara, dan]) await expect(button(page, 'Approve')).toBeVisible();
    await expect(button(alice, 'Approve')).toHaveCount(0);
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { pages: [alice] } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('24 cards');
    await expect(faq).toContainText('left bower');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Euchre differences from Wikipedia', () => {
  test('the game plays to 10', async ({ seat }) => {
    const past7 = await start(seat);
    await lastTrick(past7.table, [4, 0], { scores: [6, 0] }); // 8
    await playLastTrick(past7.pages);
    await expect(scoring(past7.pages[0]).getByRole('button', { name: 'Continue' })).toBeVisible();
    await expect(turn(past7.pages[0])).toHaveText('The hand is over');
  });

  test('the shuffled deck is split into four hands and the kitty, and seat 4 deals first', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const state = await table.state<GameState>();
    expect(state.kitty).toHaveLength(3);
    expect(state.upcard).not.toBeNull();
    for (const player of [1, 2, 3, 4]) expect(state.hands[player]).toHaveLength(5);
    await expect(seatOf(pages[0], 'Dan').locator('.seat-count')).toHaveText('5 cards, dealer');
  });

  test('the dealer may discard any card, the turned card included', async ({ seat }) => {
    const { table, pages: [alice, , , dan] } = await start(seat);
    const upcard = await upcardOf(table);
    await button(alice, 'Order up').click();
    await button(alice, 'Play with partner').click();
    await handCard(dan, upcard).click();
    await expect(dan.locator('.discards').getByLabel(label(upcard), { exact: true })).toBeVisible();
    await expect(handCard(dan, upcard)).toHaveCount(0);
  });

  test('going alone: left of the dealer leads, or the next player if they sit out, and a dealer who sits out does not pick up', async ({ seat }) => {
    const { pages: [alice, bob, , dan] } = await start(seat);
    await button(alice, 'Pass').click();
    await button(bob, 'Order up').click();
    await button(bob, 'Go alone').click();
    await expect(status(alice)).toHaveText('Bob goes alone; Dan sits out');
    await expect(hand(dan).getByRole('button')).toHaveCount(5);
    await expect(turn(alice)).toHaveText('Your turn');

    const lead = await start(seat);
    const upcard = await upcardOf(lead.table);
    const [a, b, c2, d] = lead.pages;
    await passAll(lead.pages);
    await button(a, 'Pass').click();
    await button(b, 'Pass').click();
    const suit = SUITS.find(other => other !== upcard.suit) ?? 'clubs';
    await suitPicker(c2).getByRole('button', { name: new RegExp(suit) }).click();
    await button(c2, 'Go alone').click();
    await expect(turn(b)).toHaveText('Your turn'); // Alice sits out, so Bob leads
    await expect(seatOf(d, 'Alice').locator('.seat-note')).toHaveText('sits out');
  });

  test('defenders cannot go alone', async ({ seat }) => {
    const { pages } = await start(seat);
    await button(pages[0], 'Order up').click();
    for (const page of pages.slice(1)) await expect(button(page, 'Go alone')).toHaveCount(0);
  });

  test('a card that does not follow suit when it must cannot be played', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await playing(table, { 1: [S('9')], 2: [S('10'), C('9')], 3: [S('K')], 4: [S('Q')] });
    await handCard(alice, S('9')).click();
    await expect(handCard(bob, C('9'))).toBeDisabled();
    await expect(handCard(bob, S('10'))).toBeEnabled();
  });

  test('the last trick taken stays in the middle until the next card is played, and tricks taken are counted', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await playing(table, { 1: [S('9'), C('9')], 2: [S('A'), C('10')], 3: [S('10'), C('J')], 4: [S('K'), C('Q')] });
    await handCard(alice, S('9')).click();
    await handCard(bob, S('A')).click();
    await handCard(cara, S('10')).click();
    await handCard(dan, S('K')).click();
    await expect(dan.locator('.trick-taken')).toHaveText('Bob took the trick');
    await expect(dan.locator('.trick .playing-card')).toHaveCount(4);
    await expect(dan.locator('.scoreboard .team-1 .team-tricks')).toHaveText('1 trick');
    await handCard(bob, C('10')).click();
    await expect(dan.locator('.trick-taken')).toHaveCount(0);
    await expect(dan.locator('.trick .playing-card')).toHaveCount(1);
  });

  test('a player who leaves breaks the partnership, so the game ends and the other team wins', async ({ seat }) => {
    const { pages: [alice, bob, cara, dan] } = await start(seat);
    await button(alice, 'Pass').click();
    await leave(cara);
    await dismiss('Cara', alice, bob, dan);
    await expect(status(bob)).toHaveText('Cara left, so the partnership is broken: Bob and Dan win');
    await expect(team(bob, 1)).toHaveClass(/team-winner/);
  });
});
