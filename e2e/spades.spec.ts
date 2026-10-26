import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, test, undo, type Seat, type SeatOptions, type Table } from './fixtures.ts';
import { cardName } from '../shared/playingCards.ts';
import type { Card, GameState, Seat as SeatNumber, Suit, TeamScores } from '../games/spades/types.ts';

// One test per rule, control and difference in games/spades/README.md. Seats join in order: Alice 1, Bob 2, Cara 3,
// Dan 4, so Alice and Cara are one team and Bob and Dan the other. Seat 4 deals first, so Alice bids and leads first.

type Rank = Card['rank'];
const card = (suit: Suit) => (rank: Rank): Card => ({ suit, rank });
const S = card('spades');
const H = card('hearts');
const C = card('clubs');
const D = card('diamonds');
const BIDS = { 1: 3, 2: 4, 3: 2, 4: 3 };
const NO_TRICKS = { 1: 0, 2: 0, 3: 0, 4: 0 };

async function start(seat: Seat, options?: SeatOptions): Promise<{ table: Table; pages: Page[] }> {
  const table = await seat('spades', ['Alice', 'Bob', 'Cara', 'Dan'], options);
  return { table, pages: table.pages };
}

// A hand under way: Dan dealt, everyone has bid (Alice 3, Bob 4, Cara 2, Dan 3) and Alice leads
async function playing(table: Table, hands: Record<number, Card[]>, fields: Partial<GameState> = {}): Promise<void> {
  await table.patch({
    started: true,
    phase: 'play',
    dealer: 4,
    currentPlayer: 1,
    hands,
    bids: BIDS,
    tricksTaken: NO_TRICKS,
    trick: [],
    lastTrick: null,
    spadesBroken: false,
    roundSummary: null,
    lastMove: null,
    ...fields
  });
}

type LastTrick = { bids?: Record<number, number>; taken?: Record<number, number>; scores?: TeamScores; bags?: TeamScores; winner?: SeatNumber };

// The last trick of a hand: hearts all round and `winner` holds the ace. By default Alice takes it, and with the
// tricks taken before it Alice and Cara take 7 against their 5 (52 points) and Bob and Dan 6 against their 7 (-70).
function lastTrickCards(winner: SeatNumber): Card[] {
  const low: Rank[] = ['2', '3', '4'];
  return [1, 2, 3, 4].map(seat => H(seat === winner ? 'A' : low.shift() ?? '5'));
}

async function lastTrick(table: Table, { bids = BIDS, taken = { 1: 4, 2: 4, 3: 2, 4: 2 }, scores = [0, 0], bags = [0, 0], winner = 1 }: LastTrick = {}): Promise<void> {
  const cards = lastTrickCards(winner);
  await playing(table, { 1: [cards[0]], 2: [cards[1]], 3: [cards[2]], 4: [cards[3]] }, { bids, tricksTaken: taken, scores, bags, spadesBroken: true });
}

async function playLastTrick(pages: Page[], winner: SeatNumber = 1): Promise<void> {
  const cards = lastTrickCards(winner);
  for (const [index, page] of pages.entries()) await handCard(page, cards[index]).click();
}

const hand = (page: Page) => page.getByRole('region', { name: 'Your hand' });
const handCard = (page: Page, played: Card) => hand(page).getByRole('button', { name: cardName(played), exact: true });
const position = (page: Page, where: 'bottom' | 'left' | 'top' | 'right') => page.locator(`.seats .seat-${where}`);
const seatOf = (page: Page, name: string) => page.locator('.seats .seat').filter({ hasText: name });
const turn = (page: Page) => page.locator('.turn-message');
const hint = (page: Page) => page.locator('.hint');
const status = (page: Page) => page.locator('.game-status');
const scoring = (page: Page) => page.getByRole('dialog', { name: 'Hand scoring' });
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });
const summaryTeam = (page: Page, which: 0 | 1) => scoring(page).locator('.summary-team').nth(which);
const team = (page: Page, which: 0 | 1) => page.locator(`.scoreboard .team-${which}`);
const bidButton = (page: Page) => page.getByRole('button', { name: /^Bid / });

async function bid(page: Page, tricks: number): Promise<void> {
  await page.getByRole('combobox', { name: 'Tricks', exact: true }).selectOption(String(tricks));
  await page.getByRole('button', { name: `Bid ${tricks === 0 ? 'nil' : tricks}`, exact: true }).click();
}

// One trick of Alice's 5 of hearts, Bob's king, Cara's 3 of clubs and Dan's ace: Dan takes it
async function heartsTrick(table: Table, pages: Page[]): Promise<void> {
  await playing(table, { 1: [H('5'), C('9')], 2: [H('K'), D('7')], 3: [C('3'), C('4')], 4: [H('A'), S('Q')] });
  const plays = [H('5'), H('K'), C('3'), H('A')];
  for (const [index, page] of pages.entries()) await handCard(page, plays[index]).click();
}

test.describe('Spades rules', () => {
  test('two partnerships with partners across: seats 1 and 3 against seats 2 and 4', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat);
    await expect(team(alice, 0).locator('.team-names')).toHaveText('Alice and Cara (you)');
    await expect(team(alice, 1).locator('.team-names')).toHaveText('Bob and Dan');
    await expect(team(bob, 1).locator('.team-names')).toHaveText('Bob and Dan (you)');
    await expect(position(alice, 'top').locator('.seat-name')).toHaveText('Cara (partner)');
    await expect(position(bob, 'top').locator('.seat-name')).toHaveText('Dan (partner)');
  });

  test('the whole deck is dealt, 13 cards each, seat 4 deals first and the deal passes left', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob] = pages;
    for (const page of pages) await expect(hand(page).getByRole('button')).toHaveCount(13);
    const state = await table.state<GameState>();
    expect(new Set(Object.values(state.hands).flat().map(cardName)).size).toBe(52);
    await expect(seatOf(alice, 'Dan').locator('.seat-count')).toHaveText('13 cards, dealer');

    await lastTrick(table);
    await playLastTrick(pages);
    for (const page of pages) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(status(alice)).toHaveText('Hand 2: Alice deals');
    await expect(seatOf(bob, 'Alice').locator('.seat-count')).toHaveText('13 cards, dealer');
    await expect(turn(bob)).toHaveText('Your turn'); // left of the new dealer bids first
  });

  test('bidding goes around once from the dealer\'s left to the dealer, 1 to 13 or nil, and every bid is shown', async ({ seat }) => {
    const { pages: [alice, bob, cara, dan] } = await start(seat);
    await expect(turn(alice)).toHaveText(/^Your turn/);
    await expect(bidButton(bob)).toHaveCount(0);
    await expect(alice.getByRole('combobox', { name: 'Tricks', exact: true }).locator('option')).toHaveText(['Nil', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13']);
    await bid(alice, 4);
    await bid(bob, 0);
    await bid(cara, 13);
    await expect(seatOf(dan, 'Bob').locator('.seat-bid')).toHaveText('bid nil');
    await expect(team(dan, 0).locator('.team-contract')).toHaveCount(0);
    await bid(dan, 2);
    // After the dealer's bid the play starts and the dealer's left leads
    await expect(status(alice)).toHaveText('Dan bid 2');
    await expect(hint(alice)).toHaveText('Lead any card but a spade: spades are not broken yet');
    await expect(bidButton(alice)).toHaveCount(0);
    await expect(team(bob, 0).locator('.team-contract')).toHaveText('bid 17, took 0');
    await expect(team(bob, 1).locator('.team-contract')).toHaveText('bid 2, took 0');
  });

  test('left of the dealer leads, players follow suit if they can or else play anything, the highest spade or else the highest of the suit led takes it, aces high, and the winner leads next', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await playing(table, { 1: [H('5'), C('9')], 2: [H('K'), D('7')], 3: [S('2'), C('3')], 4: [H('A'), S('Q')] });
    await expect(turn(alice)).toHaveText('Your turn');
    await handCard(alice, H('5')).click();
    await expect(handCard(bob, D('7'))).toBeDisabled();
    await handCard(bob, H('K')).click();
    // Cara has no hearts, so either card goes, and her 2 of spades beats the ace of hearts
    await expect(handCard(cara, C('3'))).toBeEnabled();
    await handCard(cara, S('2')).click();
    await expect(handCard(dan, S('Q'))).toBeDisabled();
    await handCard(dan, H('A')).click();
    await expect(alice.locator('.trick-taken')).toHaveText('Cara took the trick');
    await expect(turn(cara)).toHaveText('Your turn');

    // With no spade played, the ace takes the trick
    await heartsTrick(table, [alice, bob, cara, dan]);
    await expect(alice.locator('.trick-taken')).toHaveText('Dan took the trick');
  });

  test('a spade may not be led until spades are broken, unless the leader holds only spades', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await playing(table, { 1: [S('A'), H('5')], 2: [H('K'), D('7')], 3: [S('2'), C('3')], 4: [H('A'), S('Q')] });
    await expect(alice.locator('.hand-info')).toContainText('Spades not broken yet');
    await expect(handCard(alice, S('A'))).toBeDisabled();
    await handCard(alice, H('5')).click();
    await handCard(bob, H('K')).click();
    await handCard(cara, S('2')).click();
    await expect(alice.locator('.hand-info')).toContainText('Spades are broken');
    await handCard(dan, H('A')).click();
    // Cara took it with her spade and may now lead one
    await playing(table, { 1: [S('A')], 2: [D('7')], 3: [S('3'), C('3')], 4: [S('Q')] }, { currentPlayer: 3, spadesBroken: true });
    await expect(handCard(cara, S('3'))).toBeEnabled();

    // A hand of nothing but spades may lead one before they are broken
    await playing(table, { 1: [S('A'), S('4')], 2: [D('7')], 3: [C('3')], 4: [H('2')] });
    await expect(handCard(alice, S('4'))).toBeEnabled();
  });

  test('a team that makes its contract scores 10 per trick bid and 1 per bag; one that does not loses 10 per trick bid; scores go below zero', async ({ seat }) => {
    const { table, pages } = await start(seat);
    await lastTrick(table, { scores: [0, 20] });
    await playLastTrick(pages);
    const alice = pages[0];
    await expect(status(alice)).toHaveText('Alice and Cara score +52, Bob and Dan score -70');
    await expect(summaryTeam(alice, 0).locator('.summary-reason')).toHaveText('bid 5, took 7, made: 50 + 2 bags');
    await expect(summaryTeam(alice, 0).locator('.summary-change')).toHaveText('+52');
    await expect(summaryTeam(alice, 1).locator('.summary-reason')).toHaveText('bid 7, took 6, set: -70');
    await expect(summaryTeam(alice, 1).locator('.summary-points')).toHaveText('-50 pts, 0 bags');
  });

  test('bags add up from hand to hand, and ten cost 100 with the rest carrying on', async ({ seat }) => {
    const { table, pages } = await start(seat);
    // 8 bags before, 3 more: 50 + 3 - 100
    await lastTrick(table, { taken: { 1: 5, 2: 3, 3: 2, 4: 2 }, scores: [200, 0], bags: [8, 0] });
    await playLastTrick(pages);
    const alice = pages[0];
    await expect(summaryTeam(alice, 0).locator('.summary-reason')).toHaveText('bid 5, took 8, made: 50 + 3 bags; 10 bags: -100');
    await expect(summaryTeam(alice, 0).locator('.summary-points')).toHaveText('153 pts, 1 bag');
    for (const page of pages) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(team(alice, 0).locator('.team-bags')).toHaveText('1 bag');
  });

  test('a nil scores 100 if its bidder takes no trick and loses 100 if they take any, apart from the partner\'s contract', async ({ seat }) => {
    const made = await start(seat);
    await lastTrick(made.table, { bids: { 1: 0, 2: 4, 3: 5, 4: 4 }, taken: { 1: 0, 2: 4, 3: 4, 4: 4 }, winner: 3 });
    await playLastTrick(made.pages, 3);
    await expect(summaryTeam(made.pages[0], 0).locator('.summary-reason')).toHaveText("bid 5, took 5, made: 50 + 0 bags; Alice's nil made: +100");
    await expect(summaryTeam(made.pages[0], 0).locator('.summary-change')).toHaveText('+150');

    // Alice's trick breaks her nil but still counts toward Cara's 4
    const broken = await start(seat);
    await lastTrick(broken.table, { bids: { 1: 0, 2: 4, 3: 4, 4: 4 }, taken: { 1: 0, 2: 4, 3: 4, 4: 4 } });
    await playLastTrick(broken.pages);
    await expect(summaryTeam(broken.pages[0], 0).locator('.summary-reason')).toHaveText("bid 4, took 5, made: 40 + 1 bag; Alice's nil broken: -100");
    await expect(summaryTeam(broken.pages[0], 0).locator('.summary-change')).toHaveText('-59');
  });

  test('a scoring screen shows each hand, and the next hand waits for every connected player to Continue', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara, dan] = pages;
    await lastTrick(table);
    await playLastTrick(pages);
    await expect(scoring(alice).locator('h2')).toHaveText('Hand 1 scoring');
    await scoring(alice).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(alice).locator('.summary-waiting')).toHaveText('Waiting for Bob, Cara, Dan');
    await scoring(bob).getByRole('button', { name: 'Continue' }).click();
    await scoring(cara).getByRole('button', { name: 'Continue' }).click();
    await expect(alice.locator('.hand-info')).toContainText('Hand 1');
    // Dan's connection drops, and the next hand no longer waits for him
    await leave(dan);
    await expect(alice.locator('.hand-info')).toContainText('Hand 2, first to 500');
    await expect(scoring(alice)).toHaveCount(0);
  });

  test('the first team to 500 wins, a team that falls to -200 loses, and an equal total plays another hand', async ({ seat }) => {
    const won = await start(seat);
    await lastTrick(won.table, { scores: [460, 300] });
    await playLastTrick(won.pages);
    await expect(status(won.pages[1])).toHaveText('Alice and Cara win with 512 points!');
    await expect(turn(won.pages[1])).toHaveText('Game over');
    await expect(team(won.pages[1], 0)).toHaveClass(/team-winner/);

    const fell = await start(seat);
    await lastTrick(fell.table, { scores: [0, -150] });
    await playLastTrick(fell.pages);
    await expect(status(fell.pages[0])).toHaveText('Bob and Dan fell to -220: Alice and Cara win');
    await expect(turn(fell.pages[0])).toHaveText('Game over');

    const tied = await start(seat);
    await lastTrick(tied.table, { scores: [500, 622] }); // 552 each
    await playLastTrick(tied.pages);
    await expect(scoring(tied.pages[0]).locator('.summary-result')).toHaveText(/Both teams are tied at 552, so another hand is played$/);
    await expect(turn(tied.pages[0])).toHaveText('The hand is over');
  });

  test('you see only your own hand and the card counts; bids and tricks taken are shown', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    const state = await table.state<GameState>();
    for (const held of state.hands[1]) await expect(handCard(alice, held)).toBeVisible();
    for (const held of [...state.hands[2], ...state.hands[3], ...state.hands[4]]) {
      await expect(alice.getByLabel(cardName(held), { exact: true })).toHaveCount(0);
    }
    for (const name of ['Bob', 'Cara', 'Dan']) await expect(seatOf(alice, name).locator('.seat-count')).toHaveText(/^13 cards/);

    await heartsTrick(table, [alice, bob, cara, dan]);
    await expect(seatOf(alice, 'Dan').locator('.seat-bid')).toHaveText('bid 3');
    await expect(seatOf(alice, 'Dan').locator('.seat-tricks')).toHaveText('took 1');
    await expect(team(alice, 1).locator('.team-contract')).toHaveText('bid 7, took 1');
  });

  test('a disconnected player keeps their seat and the game waits on their turn; a dismissed player breaks the partnership and the other team wins', async ({ seat }) => {
    const { pages: [alice, bob, cara, dan] } = await start(seat);
    await bid(alice, 3);
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
    await lastTrick(table);
    await playLastTrick(pages);
    for (const page of pages) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(alice.locator('.hand-info')).toContainText('Hand 2');
    await undo(alice, bob, cara, dan);
    await expect(alice.locator('.hand-info')).toContainText('Hand 1');
    await expect(handCard(dan, H('4'))).toBeEnabled();

    await leave(bob);
    await expect(alice.getByText('Bob (disconnected)')).toBeVisible();
    await undo(alice, cara, dan);
    await expect(handCard(cara, H('3'))).toBeEnabled();

    await dismiss('Bob', alice, cara, dan);
    await expect(turn(alice)).toHaveText('Game over');
    await expect(alice.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  test('the host can set a lower target', async ({ seat }) => {
    const { table, pages } = await start(seat, { houseRules: { targetScore: 250 } });
    await lastTrick(table, { scores: [200, 0] });
    await playLastTrick(pages);
    await expect(status(pages[1])).toHaveText('Alice and Cara win with 252 points!');
    await expect(scoring(pages[1]).locator('.summary-target')).toHaveText('First to 250 points wins; a team at -200 loses');
    await expect(turn(pages[1])).toHaveText('Game over');
  });
});

test.describe('Spades controls', () => {
  test('on your bidding turn, choose a number of tricks or Nil and click Bid', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat);
    await expect(bidButton(bob)).toHaveCount(0);
    await expect(bidButton(alice)).toHaveText('Bid 1');
    await alice.getByRole('combobox', { name: 'Tricks', exact: true }).selectOption('0');
    await expect(bidButton(alice)).toHaveText('Bid nil');
    await alice.getByRole('combobox', { name: 'Tricks', exact: true }).selectOption('6');
    await bidButton(alice).click();
    await expect(seatOf(bob, 'Alice').locator('.seat-bid')).toHaveText('bid 6');
    await expect(status(bob)).toHaveText('Alice bid 6');
  });

  test('in a trick the cards you may play are raised and outlined, and clicking one plays it', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await playing(table, { 1: [H('5')], 2: [H('9'), D('6'), S('6')], 3: [C('7')], 4: [C('8')] });
    await handCard(alice, H('5')).click();
    await expect(handCard(bob, D('6'))).toBeDisabled();
    const look = await handCard(bob, H('9')).evaluate(element => [getComputedStyle(element).outlineStyle, getComputedStyle(element).transform]);
    expect(look[0]).toBe('solid');
    expect(look[1]).not.toBe('none');
    await handCard(bob, H('9')).click();
    await expect(alice.locator('.trick-left').getByLabel('9 of hearts')).toBeVisible();
  });

  test('the table shows scores, bags, contracts, the hand number and spades broken, the seats with you at the bottom and your partner across with counts, dealer, bids and tricks, and the trick in the middle', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await expect(team(alice, 0).locator('.team-score')).toHaveText('0');
    await expect(team(alice, 0).locator('.team-bags')).toHaveText('0 bags');
    await expect(alice.locator('.hand-info')).toContainText('Hand 1, first to 500');
    await expect(alice.locator('.hand-info')).toContainText('Spades not broken yet');
    await expect(position(alice, 'bottom').locator('.seat-name')).toHaveText('Alice (you)');
    await expect(position(alice, 'left').locator('.seat-name')).toHaveText('Bob');
    await expect(position(alice, 'top').locator('.seat-name')).toHaveText('Cara (partner)');
    await expect(position(alice, 'right').locator('.seat-name')).toHaveText('Dan');
    await expect(position(alice, 'right').locator('.seat-count')).toHaveText('13 cards, dealer');
    await bid(alice, 5);
    await expect(position(cara, 'top').locator('.seat-bid')).toHaveText('bid 5');

    await table.patch({ scores: [120, -30], bags: [3, 1] });
    await heartsTrick(table, [alice, bob, cara, dan]);
    await expect(team(alice, 0).locator('.team-score')).toHaveText('120');
    await expect(team(alice, 1).locator('.team-bags')).toHaveText('1 bag');
    await expect(team(alice, 0).locator('.team-contract')).toHaveText('bid 5, took 0');
    await expect(position(alice, 'right').locator('.seat-tricks')).toHaveText('took 1');
    await expect(alice.locator('.trick-taken')).toHaveText('Dan took the trick');
    await expect(alice.locator('.trick .playing-card')).toHaveCount(4);
  });

  test('after a hand click Continue on the scoring screen; after the last hand the game-over screen shows its scoring', async ({ seat }) => {
    const { table, pages } = await start(seat);
    await lastTrick(table);
    await playLastTrick(pages);
    for (const page of pages) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(pages[0])).toHaveCount(0);

    const final = await start(seat);
    const alice = final.pages[0];
    await lastTrick(final.table, { scores: [460, 0] });
    await playLastTrick(final.pages);
    const dialog = gameOver(alice);
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Alice and Cara win');
    await expect(dialog.getByRole('heading', { name: 'Hand 1 scoring' })).toBeVisible();
    await expect(dialog.locator('.game-over-meta')).toContainText('1 hand');
    await expect(dialog.locator('.summary-team', { hasText: 'Alice' }).locator('.summary-points')).toContainText('512 pts');
    await expect(scoring(alice)).toHaveCount(0);
    await dialog.getByRole('button', { name: 'See the table' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('clicking Undo asks everyone to undo the last move', async ({ seat }) => {
    const { pages: [alice, bob, cara, dan] } = await start(seat);
    await bid(alice, 3);
    await alice.getByRole('button', { name: 'Undo' }).click();
    for (const page of [bob, cara, dan]) await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { pages: [alice] } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('spades are broken');
    await expect(faq).toContainText('Continue is not a move');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Spades differences from Wikipedia', () => {
  test('breaking spades is always played, from the first trick on', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    await playing(table, { 1: [S('A'), S('K'), D('2')], 2: [H('K')], 3: [C('3')], 4: [H('A')] });
    await expect(hint(alice)).toHaveText('Lead any card but a spade: spades are not broken yet');
    await expect(handCard(alice, S('A'))).toBeDisabled();
    await expect(handCard(alice, S('K'))).toBeDisabled();
    await expect(handCard(alice, D('2'))).toBeEnabled();
  });

  test('there is no blind nil: one bid each, nil or 1 to 13', async ({ seat }) => {
    const { pages: [alice] } = await start(seat);
    await expect(alice.locator('.action-buttons button')).toHaveText([/^Bid /, 'Undo']);
    await expect(alice.getByRole('button', { name: /blind/i })).toHaveCount(0);
    await expect(alice.getByRole('combobox', { name: 'Tricks', exact: true }).locator('option')).toHaveCount(14);
  });

  test('the shuffled deck is split into four hands, seat 4 deals first and the deal passes to the left', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const state = await table.state<GameState>();
    for (const player of [1, 2, 3, 4]) expect(state.hands[player]).toHaveLength(13);
    await expect(seatOf(pages[0], 'Dan').locator('.seat-count')).toHaveText('13 cards, dealer');
    await lastTrick(table);
    await playLastTrick(pages);
    for (const page of pages) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(seatOf(pages[0], 'Alice').locator('.seat-count')).toHaveText('13 cards, dealer');
  });

  test('a team with two nil bids has no contract and scores only its nils', async ({ seat }) => {
    const { table, pages } = await start(seat);
    await lastTrick(table, { bids: { 1: 0, 2: 4, 3: 0, 4: 4 }, taken: { 1: 0, 2: 6, 3: 0, 4: 6 } });
    await playLastTrick(pages);
    await expect(summaryTeam(pages[0], 0).locator('.summary-reason')).toHaveText("Alice's nil broken: -100; Cara's nil made: +100");
    await expect(summaryTeam(pages[0], 0).locator('.summary-change')).toHaveText('+0');
    await expect(summaryTeam(pages[0], 0).locator('.summary-points')).toHaveText('0 pts, 0 bags');
  });

  test('when both teams pass 500 in one hand the higher total wins', async ({ seat }) => {
    const { table, pages } = await start(seat);
    await lastTrick(table, { scores: [490, 650] }); // 542 against 580
    await playLastTrick(pages);
    await expect(status(pages[0])).toHaveText('Bob and Dan win with 580 points!');
  });

  test('a card that does not follow suit when it must cannot be played', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await playing(table, { 1: [C('5')], 2: [C('6'), S('9')], 3: [C('7')], 4: [C('8')] });
    await handCard(alice, C('5')).click();
    await expect(handCard(bob, S('9'))).toBeDisabled();
    await expect(handCard(bob, C('6'))).toBeEnabled();
  });

  test('the last trick taken stays in the middle until the next card is played, and tricks taken are counted', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, , , dan] = pages;
    await heartsTrick(table, pages);
    await expect(alice.locator('.trick-taken')).toHaveText('Dan took the trick');
    await expect(alice.locator('.trick .playing-card')).toHaveCount(4);
    await expect(seatOf(alice, 'Dan').locator('.seat-tricks')).toHaveText('took 1');
    await handCard(dan, S('Q')).click();
    await expect(alice.locator('.trick-taken')).toHaveCount(0);
    await expect(alice.locator('.trick .playing-card')).toHaveCount(1);
  });

  test('a player who leaves breaks the partnership, so the game ends and the other team wins', async ({ seat }) => {
    const { pages: [alice, bob, cara, dan] } = await start(seat);
    await bid(alice, 3);
    await leave(cara);
    await dismiss('Cara', alice, bob, dan);
    await expect(status(bob)).toHaveText('Cara left, so the partnership is broken: Bob and Dan win');
    await expect(team(bob, 1)).toHaveClass(/team-winner/);
  });
});
