import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, test, undo, type Seat, type SeatOptions, type Table } from './fixtures.ts';
import type { Card, Color, GameState, TeamScores } from '../games/rook/types.ts';

// One test per rule and control in games/rook/README.md. Seats join in order: Alice 1, Bob 2, Cara 3, Dan 4, so
// Alice and Cara are one team and Bob and Dan the other. Seat 4 deals first, so Alice bids and leads first.

const c = (color: Color, number: number): Card => ({ color, number });
const red = (n: number) => c('red', n);
const yellow = (n: number) => c('yellow', n);
const green = (n: number) => c('green', n);
const black = (n: number) => c('black', n);
const ROOK: Card = { color: 'rook' };
const label = (card: Card) => (card.color === 'rook' ? 'the Rook' : `${card.color} ${card.number}`);

async function start(seat: Seat, options?: SeatOptions): Promise<{ table: Table; pages: Page[] }> {
  const table = await seat('rook', ['Alice', 'Bob', 'Cara', 'Dan'], options);
  return { table, pages: table.pages };
}

// A hand under way: Dan dealt, Alice won the bidding at 80, laid aside `nest`, named black trump and leads
async function playing(table: Table, hands: Record<number, Card[]>, fields: Partial<GameState> = {}): Promise<void> {
  await table.patch({
    started: true,
    phase: 'play',
    dealer: 4,
    currentPlayer: 1,
    hands,
    nest: [black(5), yellow(10), black(6), black(7), black(8)], // 15 points
    bidding: { high: { seat: 1, amount: 80 }, passed: [2, 3, 4] },
    bidder: 1,
    bid: 80,
    trump: 'black',
    trick: [],
    lastTrick: null,
    tricksWon: [0, 0],
    captured: [0, 0],
    roundSummary: null,
    lastMove: null,
    ...fields
  });
}

// The last trick of a hand: Cara's red 14 takes it with 15 points, and the nest's 15 go with it. Alice and Cara had
// taken `captured[0]` before it and Bob and Dan `captured[1]`; Alice bid 80.
async function lastTrick(table: Table, scores: TeamScores = [0, 0], captured: TeamScores = [60, 20]): Promise<void> {
  await playing(table, { 1: [red(5)], 2: [red(6)], 3: [red(14)], 4: [red(7)] }, { scores, captured, tricksWon: [5, 3] });
}

async function playLastTrick(pages: Page[]): Promise<void> {
  const cards = [red(5), red(6), red(14), red(7)];
  for (const [index, page] of pages.entries()) await handCard(page, cards[index]).click();
}

const hand = (page: Page) => page.getByRole('region', { name: 'Your hand' });
const handCard = (page: Page, card: Card) => hand(page).getByRole('button', { name: label(card), exact: true });
const position = (page: Page, where: 'bottom' | 'left' | 'top' | 'right') => page.locator(`.seats .seat-${where}`);
const seatOf = (page: Page, name: string) => page.locator('.seats .seat').filter({ hasText: name });
const turn = (page: Page) => page.locator('.turn-message');
const status = (page: Page) => page.locator('.game-status');
const scoring = (page: Page) => page.getByRole('dialog', { name: 'Hand scoring' });
const team = (page: Page, which: 0 | 1) => page.locator(`.scoreboard .team-${which}`);
const bidButton = (page: Page) => page.getByRole('button', { name: /^Bid \d+$/ });
const pass = (page: Page) => page.getByRole('button', { name: 'Pass' });

async function bid(page: Page, amount: number): Promise<void> {
  await page.getByRole('combobox', { name: 'Bid', exact: true }).selectOption(String(amount));
  await page.getByRole('button', { name: `Bid ${amount}` }).click();
}

// Picks the first five cards of the bidder's hand, lays them aside and names `trump`
async function layAsideAndName(page: Page, trump: Color): Promise<void> {
  for (let index = 0; index < 5; index++) await hand(page).getByRole('button').nth(index).click();
  await page.getByRole('button', { name: 'Lay aside 5/5' }).click();
  await page.getByRole('group', { name: 'Name trump' }).getByRole('button', { name: trump }).click();
}

test.describe('Rook rules', () => {
  test('two partnerships with partners across: seats 1 and 3 against seats 2 and 4', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat);
    await expect(team(alice, 0).locator('.team-names')).toHaveText('Alice and Cara (you)');
    await expect(team(alice, 1).locator('.team-names')).toHaveText('Bob and Dan');
    await expect(team(bob, 1).locator('.team-names')).toHaveText('Bob and Dan (you)');
    await expect(position(alice, 'top').locator('.seat-name')).toHaveText('Cara (partner)');
    await expect(position(bob, 'top').locator('.seat-name')).toHaveText('Dan (partner)');
  });

  test('the deck is 41 cards, 5 to 14 in four colors and the Rook, with 14 high and 5 low', async ({ seat }) => {
    const { table, pages } = await start(seat);
    for (const page of pages) await expect(hand(page).getByRole('button')).toHaveCount(9);
    const state = await table.state<GameState>();
    const cards = [...Object.values(state.hands).flat(), ...state.nest].map(label);
    expect(new Set(cards).size).toBe(41);
    expect(cards).toContain('the Rook');
    for (const color of ['red', 'yellow', 'green', 'black'] as Color[]) {
      for (let number = 5; number <= 14; number++) expect(cards).toContain(label(c(color, number)));
    }

    // With no trump played, the 14 takes the trick and the 5 is lowest
    await playing(table, { 1: [red(5), green(5)], 2: [red(14), green(6)], 3: [red(13), green(7)], 4: [red(12), green(8)] });
    const [alice, bob, cara, dan] = pages;
    await handCard(alice, red(5)).click();
    await handCard(bob, red(14)).click();
    await handCard(cara, red(13)).click();
    await handCard(dan, red(12)).click();
    await expect(alice.locator('.trick-taken')).toHaveText('Bob took the trick');
  });

  test('seat 4 deals first, five cards go face down to the nest and nine to each player, and the deal passes left after each hand', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob] = pages;
    await expect(seatOf(alice, 'Dan')).toContainText('9 cards, dealer');
    for (const name of ['Alice', 'Bob', 'Cara']) await expect(seatOf(alice, name).locator('.seat-count')).toHaveText('9 cards');
    await expect(alice.locator('.nest .rook-card-back')).toBeVisible();
    await expect(alice.locator('.nest-label')).toHaveText('Nest: 5 cards');

    await lastTrick(table);
    await playLastTrick(pages);
    for (const page of pages) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(status(alice)).toHaveText('Hand 2: Alice deals');
    await expect(seatOf(bob, 'Alice').locator('.seat-count')).toHaveText('9 cards, dealer');
    await expect(turn(bob)).toHaveText('Your turn'); // left of the new dealer bids first
  });

  test('each 5 counts 5, each 10 and 14 counts 10 and the Rook 20, 120 points in a hand', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice] = pages;
    await playing(table, { 1: [red(5), red(10), red(14), ROOK, red(7)], 2: [], 3: [], 4: [] });
    const points = (card: Card) => handCard(alice, card).locator('.rook-card-points');
    await expect(points(red(5))).toHaveText('5');
    await expect(points(red(10))).toHaveText('10');
    await expect(points(red(14))).toHaveText('10');
    await expect(points(ROOK)).toHaveText('20');
    await expect(points(red(7))).toHaveCount(0);

    // A fresh table: once the nest is in Alice's hand, every one of the 41 cards is on someone's screen
    const fresh = await start(seat);
    await bid(fresh.pages[0], 120);
    await expect(hand(fresh.pages[0]).getByRole('button')).toHaveCount(14);
    let total = 0;
    for (const page of fresh.pages) {
      for (const corner of await hand(page).locator('.rook-card-points').allTextContents()) total += Number(corner);
    }
    expect(total).toBe(120);
  });

  test('bidding starts left of the dealer, goes 70 to 120 in fives, must beat the last bid, a pass is final, and it ends when the rest have passed, on 120, or with a redeal when all pass', async ({ seat }) => {
    const { pages: [alice, bob, cara, dan] } = await start(seat);
    await expect(turn(alice)).toHaveText(/^Your turn/);
    await expect(alice.getByRole('combobox', { name: 'Bid', exact: true }).locator('option')).toHaveText(['70', '75', '80', '85', '90', '95', '100', '105', '110', '115', '120']);
    await bid(alice, 80);
    await expect(bob.getByRole('combobox', { name: 'Bid', exact: true }).locator('option').first()).toHaveText('85');
    await pass(bob).click();
    await pass(cara).click();
    await bid(dan, 90);
    // Bob passed, so the bidding goes from Dan straight back to Alice
    await expect(turn(alice)).toHaveText(/^Your turn/);
    await expect(bidButton(bob)).toHaveCount(0);
    await pass(alice).click();
    await expect(status(alice)).toHaveText('Dan won the bidding at 90 and takes the nest');
    await expect(hand(dan).getByRole('button')).toHaveCount(14);

    const quick = await start(seat);
    await bid(quick.pages[0], 120);
    await expect(status(quick.pages[1])).toHaveText('Alice bid 120, the most there is, and takes the nest');
    await expect(quick.pages[0].locator('.hint')).toHaveText('The nest is in your hand: pick 5 cards to lay aside');

    const none = await start(seat);
    for (const page of none.pages) await pass(page).click();
    await expect(status(none.pages[0])).toHaveText('Dan passed. Everyone passed, so the cards are dealt again');
    await expect(seatOf(none.pages[0], 'Alice').locator('.seat-count')).toHaveText('9 cards, dealer');
    await expect(turn(none.pages[1])).toHaveText('Your turn');
  });

  test('the bid winner adds the nest, lays any 5 cards aside, then names trump; only the bidder sees the cards laid aside', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    const nest = (await table.state<GameState>()).nest;
    await bid(alice, 120);
    for (const card of nest) await expect(handCard(alice, card)).toBeVisible();
    await expect(alice.getByRole('group', { name: 'Name trump' })).toHaveCount(0); // not before laying aside
    await layAsideAndName(alice, 'green');
    await expect(hand(alice).getByRole('button')).toHaveCount(9);
    await expect(alice.locator('.discards .rook-card')).toHaveCount(5);
    await expect(alice.locator('.hand-info')).toContainText('Trump: green');
    await expect(bob.locator('.discards')).toHaveCount(0);
    const laidAside = (await table.state<GameState>()).nest;
    for (const card of laidAside) await expect(bob.getByLabel(label(card), { exact: true })).toHaveCount(0);
  });

  test('left of the dealer leads, players follow the color led if they can or else play anything, the highest trump or else the highest of the color led takes it, and its winner leads next', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await playing(table, {
      1: [red(5), green(7)],
      2: [red(14), black(6)],
      3: [red(6), green(9)],
      4: [yellow(8), black(13)]
    });
    await expect(alice.locator('.hint')).toHaveText('Lead any card');
    await handCard(alice, red(5)).click();
    await expect(handCard(bob, black(6))).toBeDisabled(); // Bob holds red
    await handCard(bob, red(14)).click();
    await expect(handCard(cara, green(9))).toBeDisabled();
    await handCard(cara, red(6)).click();
    // Dan holds no red, so either card goes, and his trump beats the red 14
    await expect(handCard(dan, yellow(8))).toBeEnabled();
    await handCard(dan, black(13)).click();
    await expect(alice.locator('.trick-taken')).toHaveText('Dan took the trick');
    await expect(turn(dan)).toHaveText('Your turn');
    await expect(dan.locator('.hint')).toHaveText('Lead any card');
  });

  test('the Rook is the highest trump and may be played at any time; when it is led trump must be played, and a player whose only trump is the Rook must play it on trump', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    // Red led: Bob may follow with red or play the Rook, but not his green
    await playing(table, { 1: [green(5)], 2: [red(9), ROOK, green(6)], 3: [green(7)], 4: [green(8)] }, { trick: [{ seat: 1, card: red(5) }], currentPlayer: 2 });
    await expect(handCard(bob, red(9))).toBeEnabled();
    await expect(handCard(bob, ROOK)).toBeEnabled();
    await expect(handCard(bob, green(6))).toBeDisabled();
    // The Rook led: Bob must play his black trump
    await playing(table, { 1: [green(5)], 2: [black(9), red(6)], 3: [green(7)], 4: [green(8)] }, { trick: [{ seat: 1, card: ROOK }], currentPlayer: 2 });
    await expect(handCard(bob, black(9))).toBeEnabled();
    await expect(handCard(bob, red(6))).toBeDisabled();
    // Black led: the Rook is Bob's only trump, so he must play it, and it beats the black 14
    await playing(table, { 1: [green(5)], 2: [ROOK, red(6)], 3: [red(7), green(7)], 4: [red(8), green(8)] }, { trick: [{ seat: 1, card: black(14) }], currentPlayer: 2 });
    await expect(handCard(bob, red(6))).toBeDisabled();
    await handCard(bob, ROOK).click();
    await handCard(cara, red(7)).click();
    await handCard(dan, red(8)).click();
    await expect(alice.locator('.trick-taken')).toHaveText('Bob took the trick');
  });

  test('whoever takes the last trick also takes the cards laid aside and their counters', async ({ seat }) => {
    const { table, pages } = await start(seat);
    await lastTrick(table);
    await playLastTrick(pages);
    const dialog = scoring(pages[1]);
    await expect(dialog.locator('.summary-detail')).toHaveText('Alice bid 80 and made it. Cara took the last trick and the nest (15 points).');
    await expect(dialog.locator('.summary-team').first()).toContainText('took 90'); // 60 before, 15 in the trick, 15 in the nest
  });

  test('a team that makes its bid scores what it took, one that does not loses its bid, the other team scores what it took, scores go below zero, and the next hand waits for every connected player to Continue', async ({ seat }) => {
    const made = await start(seat);
    await lastTrick(made.table);
    await playLastTrick(made.pages);
    const [alice, bob, cara, dan] = made.pages;
    await expect(status(alice)).toHaveText("Alice's team bid 80 and took 90: they score 90");
    await expect(scoring(alice).locator('.summary-team').nth(0)).toContainText('took 90: +90');
    await expect(scoring(alice).locator('.summary-team').nth(0)).toContainText('90 pts');
    await expect(scoring(alice).locator('.summary-team').nth(1)).toContainText('took 20: +20');
    await scoring(alice).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(alice).locator('.summary-waiting')).toHaveText('Waiting for Bob, Cara, Dan');
    await scoring(bob).getByRole('button', { name: 'Continue' }).click();
    await scoring(cara).getByRole('button', { name: 'Continue' }).click();
    await expect(alice.locator('.hand-info')).toContainText('Hand 1');
    // Dan's connection drops, and the next hand no longer waits for him
    await leave(dan);
    await expect(alice.locator('.hand-info')).toContainText('Hand 2, first to 500');
    await expect(scoring(alice)).toHaveCount(0);

    const set = await start(seat);
    await lastTrick(set.table, [50, 0], [30, 50]);
    await playLastTrick(set.pages);
    const view = scoring(set.pages[0]);
    await expect(view.locator('.summary-result')).toHaveText("Alice's team bid 80 and took 60: they lose 80");
    await expect(view.locator('.summary-team').nth(0)).toContainText('took 60: -80');
    await expect(view.locator('.summary-team').nth(0)).toContainText('-30 pts');
    await expect(view.locator('.summary-team').nth(1)).toContainText('took 50: +50');
  });

  test('the first team to 500 wins, the higher total if both reach it, and an equal total plays another hand', async ({ seat }) => {
    const first = await start(seat);
    await lastTrick(first.table, [450, 400]);
    await playLastTrick(first.pages);
    await expect(status(first.pages[1])).toHaveText('Alice and Cara win with 540 points!');
    await expect(turn(first.pages[1])).toHaveText('Game over');

    const both = await start(seat);
    await lastTrick(both.table, [480, 490]); // 570 against 510
    await playLastTrick(both.pages);
    await expect(status(both.pages[1])).toHaveText('Alice and Cara win with 570 points!');

    const tied = await start(seat);
    await lastTrick(tied.table, [480, 550]); // 570 each
    await playLastTrick(tied.pages);
    await expect(scoring(tied.pages[0]).locator('.summary-result')).toHaveText(/Both teams are tied at 570, so another hand is played$/);
    await expect(scoring(tied.pages[0]).getByRole('button', { name: 'Continue' })).toBeVisible();
    await expect(turn(tied.pages[0])).toHaveText('The hand is over');
  });

  test('you see only your own hand and the card counts; the nest, the cards laid aside and the counters taken stay hidden until scoring, but tricks taken are shown', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    const state = await table.state<GameState>();
    for (const card of state.hands[1]) await expect(handCard(alice, card)).toBeVisible();
    for (const card of [...state.hands[2], ...state.hands[3], ...state.hands[4], ...state.nest]) {
      await expect(alice.getByLabel(label(card), { exact: true })).toHaveCount(0);
    }
    for (const name of ['Bob', 'Cara', 'Dan']) await expect(seatOf(alice, name).locator('.seat-count')).toHaveText(/^9 cards/);
    await expect(alice.locator('.nest .rook-card-back')).toBeVisible();

    // A trick worth 25 is taken, but the score stays at 0 until the hand is scored
    await playing(table, { 1: [red(5), green(5)], 2: [red(14), green(6)], 3: [red(10), green(7)], 4: [red(12), green(8)] });
    await handCard(alice, red(5)).click();
    await handCard(bob, red(14)).click();
    await handCard(cara, red(10)).click();
    await handCard(dan, red(12)).click();
    await expect(team(alice, 1).locator('.team-tricks')).toHaveText('1 trick');
    await expect(team(alice, 1).locator('.team-score')).toHaveText('0');
    await expect(alice.getByText('25')).toHaveCount(0);
  });

  test('a disconnected player keeps their seat and the game waits on their turn; a dismissed player breaks the partnership and the other team wins', async ({ seat }) => {
    const { pages: [alice, bob, cara, dan] } = await start(seat);
    await bid(alice, 80);
    await leave(bob);
    await expect(alice.getByText('Waiting for Bob to reconnect')).toBeVisible();
    await expect(turn(alice)).toHaveText("Bob's turn");
    await expect(seatOf(alice, 'Bob')).toBeVisible();
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
    // The last move was Dan's card, before the scoring and the Continues
    await undo(alice, bob, cara, dan);
    await expect(alice.locator('.hand-info')).toContainText('Hand 1');
    await expect(handCard(dan, red(7))).toBeEnabled();

    // With Bob gone, the three still connected decide
    await leave(bob);
    await expect(alice.getByText('Bob (disconnected)')).toBeVisible();
    await undo(alice, cara, dan);
    await expect(handCard(cara, red(14))).toBeEnabled();

    // Once Bob is dismissed only three seats are filled, and Undo is off
    await dismiss('Bob', alice, cara, dan);
    await expect(turn(alice)).toHaveText('Game over');
    await expect(alice.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  test('the host can set a lower target', async ({ seat }) => {
    const { table, pages } = await start(seat, { houseRules: { targetScore: 300 } });
    await lastTrick(table, [230, 0]);
    await playLastTrick(pages);
    await expect(status(pages[1])).toHaveText('Alice and Cara win with 320 points!');
    await expect(scoring(pages[1]).locator('.summary-target')).toHaveText('First to 300 points wins');
    await expect(turn(pages[1])).toHaveText('Game over');
  });
});

test.describe('Rook controls', () => {
  test('on your bidding turn, choose an amount and click Bid, or click Pass', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat);
    await expect(bidButton(bob)).toHaveCount(0);
    await expect(bidButton(alice)).toHaveText('Bid 70');
    await alice.getByRole('combobox', { name: 'Bid', exact: true }).selectOption('85');
    await expect(bidButton(alice)).toHaveText('Bid 85');
    await bidButton(alice).click();
    await expect(seatOf(bob, 'Alice').locator('.seat-bid')).toHaveText('bid 85');
    await pass(bob).click();
    await expect(seatOf(alice, 'Bob').locator('.seat-bid')).toHaveText('passed');
  });

  test('the bid winner clicks 5 cards to pick them, clicking again to put one back, then Lay aside, then a color for trump', async ({ seat }) => {
    const { pages: [alice] } = await start(seat);
    await bid(alice, 120);
    const cards = hand(alice).getByRole('button');
    const layAside = alice.getByRole('button', { name: /^Lay aside/ });
    await expect(layAside).toHaveText('Lay aside 0/5');
    await expect(layAside).toBeDisabled();
    for (let index = 0; index < 5; index++) await cards.nth(index).click();
    await expect(cards.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(cards.nth(5)).toBeDisabled(); // five are picked already
    await cards.nth(0).click();
    await expect(cards.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(layAside).toHaveText('Lay aside 4/5');
    await cards.nth(5).click();
    await expect(layAside).toHaveText('Lay aside 5/5');
    await layAside.click();
    const colors = alice.getByRole('group', { name: 'Name trump' }).getByRole('button');
    await expect(colors).toHaveText(['red', 'yellow', 'green', 'black']);
    await colors.filter({ hasText: 'yellow' }).click();
    await expect(status(alice)).toHaveText('Alice named yellow trump');
  });

  test('in a trick the cards you may play are raised and outlined, and clicking one plays it', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await playing(table, { 1: [green(5)], 2: [red(9), green(6), yellow(6)], 3: [green(7)], 4: [green(8)] });
    await handCard(alice, green(5)).click();
    await expect(handCard(bob, green(6))).toHaveClass(/rook-card-playable/);
    await expect(handCard(bob, red(9))).not.toHaveClass(/rook-card-playable/);
    const look = await handCard(bob, green(6)).evaluate(element => [getComputedStyle(element).outlineStyle, getComputedStyle(element).transform]);
    expect(look[0]).toBe('solid');
    expect(look[1]).not.toBe('none');
    await handCard(bob, green(6)).click();
    await expect(alice.locator('.trick-left').getByLabel('green 6')).toBeVisible();
  });

  test('the table shows scores, tricks, hand number, bid and trump, the seats with you at the bottom and your partner across, with counts, dealer and bids, and in the middle the nest, the trick or the last trick taken', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await expect(team(alice, 0).locator('.team-score')).toHaveText('0');
    await expect(team(alice, 0).locator('.team-tricks')).toHaveText('0 tricks');
    await expect(alice.locator('.hand-info')).toContainText('Hand 1, first to 500');
    await expect(alice.locator('.hand-info')).toContainText('Trump: not named yet');
    await expect(position(alice, 'bottom').locator('.seat-name')).toHaveText('Alice (you)');
    await expect(position(alice, 'left').locator('.seat-name')).toHaveText('Bob');
    await expect(position(alice, 'top').locator('.seat-name')).toHaveText('Cara (partner)');
    await expect(position(alice, 'right').locator('.seat-name')).toHaveText('Dan');
    await expect(position(alice, 'right').locator('.seat-count')).toHaveText('9 cards, dealer');
    await expect(alice.locator('.trick .nest-label')).toHaveText('Nest: 5 cards');
    await bid(alice, 75);
    await expect(position(cara, 'top').locator('.seat-bid')).toHaveText('bid 75');

    await playing(table, { 1: [red(5), green(5)], 2: [red(14), green(6)], 3: [red(6), green(7)], 4: [red(7), green(8)] });
    await expect(alice.locator('.hand-info')).toContainText('Bid: Alice 80');
    await expect(alice.locator('.hand-info .color-name')).toHaveText('black');
    await expect(position(bob, 'right').locator('.seat-bid')).toHaveText('bid 80');
    await handCard(alice, red(5)).click();
    await expect(bob.locator('.trick-right').getByLabel('red 5')).toBeVisible();
    await handCard(bob, red(14)).click();
    await handCard(cara, red(6)).click();
    await handCard(dan, red(7)).click();
    await expect(alice.locator('.trick-taken')).toHaveText('Bob took the trick');
    await expect(alice.locator('.trick .rook-card')).toHaveCount(4);
    await expect(team(alice, 1).locator('.team-tricks')).toHaveText('1 trick');
  });

  test('the bidder sees the cards they laid aside below their hand', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat);
    await bid(alice, 120);
    const picked = await hand(alice).getByRole('button').evaluateAll(cards => cards.slice(0, 5).map(card => card.getAttribute('aria-label')));
    await layAsideAndName(alice, 'red');
    const below = alice.locator('.hand .discards');
    await expect(below.locator('.discards-label')).toHaveText('Laid aside (only you see these; they go with the last trick):');
    await expect(below.locator('.rook-card')).toHaveCount(5);
    for (const name of picked) await expect(below.getByLabel(name!, { exact: true })).toBeVisible();
    await expect(bob.locator('.discards')).toHaveCount(0);
  });

  test('after a hand click Continue on the scoring screen; after the last hand click Close, and Show Scoring opens it again', async ({ seat }) => {
    const { table, pages } = await start(seat);
    await lastTrick(table);
    await playLastTrick(pages);
    await expect(scoring(pages[0]).locator('h2')).toHaveText('Hand 1 scoring');
    for (const page of pages) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(pages[0])).toHaveCount(0);

    const final = await start(seat);
    const alice = final.pages[0];
    await lastTrick(final.table, [450, 0]);
    await playLastTrick(final.pages);
    await expect(scoring(alice).locator('h2')).toHaveText('Final scoring');
    await expect(scoring(alice).getByRole('button', { name: 'Continue' })).toHaveCount(0);
    await scoring(alice).getByRole('button', { name: 'Close' }).click();
    await expect(scoring(alice)).toHaveCount(0);
    await alice.getByRole('button', { name: 'Show Scoring' }).click();
    await expect(scoring(alice)).toContainText('Alice and Cara win with 540 points!');
  });

  test('clicking Undo asks everyone to undo the last move', async ({ seat }) => {
    const { pages: [alice, bob, cara, dan] } = await start(seat);
    await bid(alice, 70);
    await alice.getByRole('button', { name: 'Undo' }).click();
    for (const page of [bob, cara, dan]) await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { pages: [alice] } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('41 cards');
    await expect(faq).toContainText('Continue is not a move');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Rook differences from Wikipedia', () => {
  test('the game plays to 500, not 300', async ({ seat }) => {
    const past300 = await start(seat);
    await lastTrick(past300.table, [290, 0]); // 380
    await playLastTrick(past300.pages);
    await expect(scoring(past300.pages[0]).getByRole('button', { name: 'Continue' })).toBeVisible();
    await expect(turn(past300.pages[0])).toHaveText('The hand is over');

    const past500 = await start(seat);
    await lastTrick(past500.table, [420, 0]); // 510
    await playLastTrick(past500.pages);
    await expect(turn(past500.pages[0])).toHaveText('Game over');
  });

  test('there is no redeal for a hand without counters', async ({ seat }) => {
    const { pages: [alice] } = await start(seat);
    await expect(bidButton(alice)).toBeVisible();
    await expect(alice.locator('.action-buttons button')).toHaveText([/^Bid \d+$/, 'Pass', 'Undo']);
    await expect(alice.getByRole('button', { name: /redeal/i })).toHaveCount(0);
  });

  test('when everyone passes, the next dealer deals a new hand', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const before = (await table.state<GameState>()).hands[1].map(label);
    for (const page of pages) await pass(page).click();
    await expect(seatOf(pages[0], 'Alice').locator('.seat-count')).toHaveText('9 cards, dealer');
    await expect(turn(pages[1])).toHaveText('Your turn');
    const after = (await table.state<GameState>()).hands[1].map(label);
    expect(after).not.toEqual(before);
  });

  test('the shuffled deck is split into the nest and four hands, seat 4 deals first and the deal passes to the left', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const state = await table.state<GameState>();
    expect(state.nest).toHaveLength(5);
    for (const player of [1, 2, 3, 4]) expect(state.hands[player]).toHaveLength(9);
    await expect(seatOf(pages[0], 'Dan').locator('.seat-count')).toHaveText('9 cards, dealer');
    for (const page of pages) await pass(page).click();
    await expect(seatOf(pages[0], 'Alice').locator('.seat-count')).toHaveText('9 cards, dealer');
    for (const page of [pages[1], pages[2], pages[3], pages[0]]) await pass(page).click();
    await expect(seatOf(pages[0], 'Bob').locator('.seat-count')).toHaveText('9 cards, dealer');
  });

  test('a card that does not follow suit when it must cannot be played', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await playing(table, { 1: [green(5)], 2: [green(6), red(9)], 3: [green(7)], 4: [green(8)] });
    await handCard(alice, green(5)).click();
    await expect(handCard(bob, red(9))).toBeDisabled();
    await expect(handCard(bob, green(6))).toBeEnabled();
  });

  test('the last trick taken stays in the middle until the next card is played, and tricks taken are counted', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await playing(table, { 1: [red(5), green(5)], 2: [red(14), green(6)], 3: [red(6), green(7)], 4: [red(7), green(8)] });
    await handCard(alice, red(5)).click();
    await handCard(bob, red(14)).click();
    await handCard(cara, red(6)).click();
    await handCard(dan, red(7)).click();
    await expect(dan.locator('.trick-taken')).toHaveText('Bob took the trick');
    await expect(dan.locator('.trick .rook-card')).toHaveCount(4);
    await expect(dan.locator('.scoreboard .team-1 .team-tricks')).toHaveText('1 trick');
    await handCard(bob, green(6)).click();
    await expect(dan.locator('.trick-taken')).toHaveCount(0);
    await expect(dan.locator('.trick .rook-card')).toHaveCount(1);
  });

  test('a player who leaves breaks the partnership, so the game ends and the other team wins', async ({ seat }) => {
    const { pages: [alice, bob, cara, dan] } = await start(seat);
    await bid(alice, 70);
    await leave(cara);
    await dismiss('Cara', alice, bob, dan);
    await expect(status(bob)).toHaveText('Cara left, so the partnership is broken: Bob and Dan win');
    await expect(team(bob, 1)).toHaveClass(/team-winner/);
  });
});
