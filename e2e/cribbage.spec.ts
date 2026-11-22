import type { Page } from '@playwright/test';
import { agreeToHouseRules, dismiss, expect, headerButton, inHouseRules, joinPassAndPlay, leave, newPlayer, openControls, openFaq, setHouseRules, test, undo, type Seat, type SeatOptions, type Table } from './fixtures.ts';
import { scoreShow } from '../games/cribbage/scoring.ts';
import type { Card, GameState, Rank, Show, Suit } from '../games/cribbage/types.ts';

// One test per rule and control in games/cribbage/README.md. Seats join in order: Alice 1, Bob 2, Cara 3, Dan 4. Most
// tests are two players with Alice dealing, so Bob cuts, leads the pegging and counts first.

const c = (suit: Suit, rank: Rank): Card => ({ suit, rank });
const H = (rank: Rank) => c('hearts', rank);
const D = (rank: Rank) => c('diamonds', rank);
const S = (rank: Rank) => c('spades', rank);
const C = (rank: Rank) => c('clubs', rank);
const NAMES: Partial<Record<Rank, string>> = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' };
const label = (card: Card) => `${NAMES[card.rank] ?? card.rank} of ${card.suit}`;

// Bob's hand counts "Fifteen two, fifteen four, and a pair is six" with the starter; Alice's hand counts seven and the
// crib two, so a whole hand is 6 + 7 + 2 and Alice also pegs 1 for the last card
const STARTER = S('2');
const BOB_HAND = [C('7'), H('7'), D('8'), S('K')];
const ALICE_HAND = [C('A'), D('3'), S('9'), S('Q')];
const CRIB = [C('K'), D('K'), H('4'), C('8')];
const SIX = 'Fifteen two, fifteen four, and a pair is six';

type Players = { table: Table; pages: Page[] };
async function start(seat: Seat, names: string[], options?: SeatOptions): Promise<Players> {
  const table = await seat('cribbage', names, options);
  return { table, pages: table.pages };
}
const twoPlayers = (seat: Seat, options?: SeatOptions) => start(seat, ['Alice', 'Bob'], options);

const base = {
  started: true, handNumber: 1, deck: [], pile: [], count: 0, saidGo: [], shows: [], showIndex: 0, roundSummary: null, lastMove: null, gameStatus: ''
};
const pegsOf = (scores: Record<number, number>) => Object.fromEntries(Object.entries(scores).map(([side, front]) => [side, { front, back: 0 }]));
const scoresOf = (scores: Record<number, number>) => ({ scores, handStartScores: scores, pegs: pegsOf(scores) });
const none = { 1: 0, 2: 0 };

// Pegging in a two-player hand dealt by Alice; Bob leads
async function pegging(table: Table, hands: Record<number, Card[]>, fields: Partial<GameState> = {}): Promise<void> {
  await table.patch({
    ...base, phase: 'pegging', dealer: 1, currentPlayer: 2, hands, crib: CRIB, starter: STARTER, played: { 1: [], 2: [] }, ...scoresOf(none), ...fields
  });
}

// Each hand's last card in hand, the rest played already
const lastCards = (table: Table, fields: Partial<GameState> = {}) =>
  pegging(table, { 1: [S('Q')], 2: [S('K')] }, { played: { 1: ALICE_HAND.slice(0, 3), 2: BOB_HAND.slice(0, 3) }, ...fields });

function countOf(owner: number, crib: boolean, cards: Card[], starter: Card, fields: Partial<Show> = {}): Show {
  const items = scoreShow(cards, starter, crib);
  return { owner, crib, cards, items, total: items.reduce((sum, item) => sum + item.points, 0), claimed: null, muggins: [], passed: [], taken: [], closesAt: null, ...fields };
}

// Every card is played and Bob's count is open, waiting for his claim; Alice has pegged 1 for the last card
const showing = (table: Table, fields: Partial<GameState> = {}) =>
  table.patch({
    ...base, phase: 'show', dealer: 1, currentPlayer: 2, hands: { 1: [], 2: [] }, crib: CRIB, starter: STARTER, played: { 1: ALICE_HAND, 2: BOB_HAND },
    shows: [countOf(2, false, BOB_HAND, STARTER)], ...scoresOf({ 1: 1, 2: 0 }), ...fields
  });

const hand = (page: Page) => page.getByRole('region', { name: 'Your hand' });
const handCard = (page: Page, card: Card) => hand(page).getByRole('button', { name: label(card), exact: true });
const shownCard = (page: Page, card: Card) => page.locator('.show-panel').getByRole('button', { name: label(card), exact: true });
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.turn-message');
const hint = (page: Page) => page.locator('.hint');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const score = (page: Page, name: string) => page.locator('.peg-score').filter({ hasText: name }).locator('.peg-points');
const summary = (page: Page) => page.getByRole('dialog', { name: 'Hand scoring' });
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });

async function claim(page: Page, points: number): Promise<void> {
  await page.getByLabel('Your count').fill(String(points));
  await button(page, 'Claim').click();
}

test.describe('Cribbage rules', () => {
  test('2 players get 6 cards and lay 2 in the crib; 3 get 5, lay 1, and a card from the deck joins the crib; 4 get 5 and lay 1', async ({ seat }) => {
    const two = await twoPlayers(seat);
    expect((await two.table.state<GameState>()).hands[1]).toHaveLength(6);
    await expect(hand(two.pages[0]).getByRole('button')).toHaveCount(6);
    const three = await start(seat, ['Alice', 'Bob', 'Cara']);
    const state = await three.table.state<GameState>();
    expect(Object.values(state.hands).map(cards => cards.length)).toEqual([5, 5, 5]);
    expect(state.crib).toHaveLength(1);
    await expect(three.pages[0].locator('.crib')).toContainText('1 card');
    const four = await start(seat, ['Alice', 'Bob', 'Cara', 'Dan']);
    expect(Object.values((await four.table.state<GameState>()).hands).map(cards => cards.length)).toEqual([5, 5, 5, 5]);
  });

  test('the lowest card dealt to each seat deals first, and the status line says so', async ({ seat }) => {
    const { pages: [alice, bob] } = await twoPlayers(seat);
    await expect(status(alice)).toHaveText(/ cut low with the .* and deals$/);
    await expect(status(bob)).toHaveText(await status(alice).innerText());
  });

  test('everyone lays cards in the crib at once; the cut follows from the seat after the dealer', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await twoPlayers(seat);
    await table.patch({
      ...base, phase: 'discard', dealer: 1, currentPlayer: null, crib: [], starter: null, played: { 1: [], 2: [] }, ...scoresOf(none),
      hands: { 1: [...ALICE_HAND, C('5'), C('6')], 2: [...BOB_HAND, H('2'), H('3')] }
    });
    await expect(hint(alice)).toHaveText('Choose 2 cards for your crib');
    await expect(hint(bob)).toHaveText("Choose 2 cards for Alice's crib");
    await expect(button(bob, 'Send to crib')).toBeDisabled();
    await handCard(bob, H('2')).click();
    await expect(button(bob, 'Send to crib')).toBeDisabled();
    await handCard(bob, H('3')).click();
    await expect(handCard(bob, S('K'))).toBeDisabled(); // a third pick is not allowed while two are chosen
    await button(bob, 'Send to crib').click();
    await expect(hint(bob)).toHaveText('Waiting for the others to lay their cards in the crib');
    await expect(hand(bob).getByRole('button')).toHaveCount(4);
    await handCard(alice, C('5')).click();
    await handCard(alice, C('6')).click();
    await button(alice, 'Send to crib').click();
    await expect(status(alice)).toHaveText('The crib is laid: Bob cuts the starter');
    await expect(alice.locator('.crib')).toContainText('4 cards');
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(button(bob, 'Cut')).toBeVisible();
    await expect(button(alice, 'Cut')).toHaveCount(0);
  });

  test('the cut turns up the starter, and a jack scores 2 for the dealer (his heels)', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await twoPlayers(seat);
    await table.patch({
      ...base, phase: 'cut', dealer: 1, currentPlayer: 2, crib: CRIB, starter: null, deck: [H('J'), D('3'), D('4')],
      hands: { 1: ALICE_HAND, 2: BOB_HAND }, played: { 1: [], 2: [] }, ...scoresOf(none)
    });
    await table.random(0);
    await button(bob, 'Cut').click();
    await expect(status(alice)).toHaveText('Bob cut the jack of hearts. His heels: Alice scores 2');
    await expect(score(alice, 'Alice')).toHaveText('2');
    await expect(score(bob, 'Bob')).toHaveText('0');
    await expect(alice.locator('.starter').getByRole('img', { name: 'jack of hearts' })).toBeVisible();
    await expect(turn(bob)).toHaveText('Your turn'); // the cutter leads the pegging
  });

  test('pegging scores a fifteen and a pair, shows the count, and greys out cards past 31', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await twoPlayers(seat);
    await pegging(table, { 1: [D('8'), C('6'), D('K'), C('4')], 2: [C('7'), S('8'), H('2'), H('3')] });
    await handCard(bob, C('7')).click();
    await expect(alice.locator('.pile-count')).toHaveText('Count: 7');
    await handCard(alice, D('8')).click();
    await expect(status(bob)).toHaveText('Alice played the 8 of diamonds for 15. Fifteen two is two');
    await expect(score(bob, 'Alice')).toHaveText('2');
    await handCard(bob, S('8')).click();
    await expect(status(alice)).toHaveText('Bob played the 8 of spades for 23. A pair is two');
    await expect(score(alice, 'Bob')).toHaveText('2');
    await expect(alice.locator('.pile-count')).toHaveText('Count: 23');
    await expect(handCard(alice, D('K'))).toBeDisabled(); // 33 is past 31
    await expect(handCard(alice, C('6'))).toBeEnabled();
    await expect(hint(alice)).toHaveText('Play a card: the count may not pass 31');
  });

  test('Go: when no card fits, both say Go and the last to play scores 1 and the count starts again', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await twoPlayers(seat);
    await pegging(table, { 1: [S('Q'), D('K')], 2: [S('K'), H('Q')] }, {
      count: 25, pile: [{ seat: 1, card: C('K') }, { seat: 2, card: H('5') }, { seat: 1, card: C('Q') }]
    });
    await expect(hint(bob)).toHaveText('No card fits under 31: say Go');
    await expect(handCard(bob, S('K'))).toBeDisabled();
    await button(bob, 'Go').click();
    await expect(status(alice)).toHaveText('Bob says Go');
    await expect(hint(alice)).toHaveText('No card fits under 31: say Go');
    await button(alice, 'Go').click();
    await expect(status(bob)).toHaveText('Alice says Go. Alice scores 1 for the go');
    await expect(score(bob, 'Alice')).toHaveText('1');
    await expect(bob.locator('.pile-count')).toHaveText('Count: 0');
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('the last card scores 1, and with Muggins off each count is made for you and the round summary lists every breakdown', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await twoPlayers(seat);
    await lastCards(table);
    await handCard(bob, S('K')).click();
    await handCard(alice, S('Q')).click();
    for (const page of [alice, bob]) {
      const dialog = summary(page);
      await expect(dialog).toBeVisible();
      const counts = dialog.locator('.summary-count');
      await expect(counts).toHaveCount(3);
      await expect(counts.nth(0)).toContainText("Bob's hand");
      await expect(counts.nth(0)).toContainText(SIX);
      await expect(counts.nth(1)).toContainText("Alice's hand");
      await expect(counts.nth(1)).toContainText('Fifteen two, fifteen four, and a run of three is seven');
      await expect(counts.nth(2)).toContainText("Alice's crib");
      await expect(counts.nth(2)).toContainText('A pair is two');
      await expect(dialog.locator('.summary-side').filter({ hasText: 'Alice' })).toContainText('+10');
      await expect(dialog.locator('.summary-side').filter({ hasText: 'Alice' })).toContainText('10 pts');
      await expect(dialog.locator('.summary-side').filter({ hasText: 'Bob' })).toContainText('6 pts');
      await expect(dialog.locator('.summary-target')).toHaveText('First to 121 points wins');
      await expect(status(page)).toHaveText('The crib: A pair is two');
    }
    await summary(alice).getByRole('button', { name: 'Continue' }).click();
    await summary(bob).getByRole('button', { name: 'Continue' }).click();
    await expect(status(alice)).toContainText('Hand 2: Bob deals');
  });

  test('the Muggins style rule is offered only when Muggins is on', async ({ seat }) => {
    const { pages: [alice] } = await twoPlayers(seat);
    await inHouseRules(alice, async dialog => {
      await expect(dialog.getByLabel('Muggins', { exact: true })).not.toBeChecked();
      await expect(dialog.getByLabel('Muggins style')).toHaveCount(0);
      await expect(dialog.getByLabel('Game length', { exact: true })).toHaveValue('121');
    });
    await setHouseRules(alice, 'cribbage', { muggins: true });
    await inHouseRules(alice, async dialog => {
      const style = dialog.getByLabel('Muggins style', { exact: true });
      await expect(style).toHaveValue('name');
      await expect(style.locator('option')).toHaveText(['Name the points', 'Single press', 'Shown total']);
    });
  });

  test('Name the points: opponents see only the claim, a wrong selection is refused, and a named combination takes its points', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await twoPlayers(seat, { houseRules: { muggins: true, mugginsStyle: 'name' } });
    await showing(table);
    await expect(alice.locator('.show-claim')).toHaveText('Waiting for Bob to count');
    await claim(bob, 4);
    await expect(alice.locator('.show-claim')).toHaveText('Bob claimed 4');
    await expect(alice.locator('.show-breakdown')).toHaveCount(0); // the true count stays hidden
    await expect(alice.locator('.show-clock')).toContainText('seconds left');
    await button(alice, 'Muggins!').click();
    await shownCard(alice, C('7')).click();
    await shownCard(alice, S('K')).click();
    await button(alice, 'Claim these').click();
    await expect(status(alice)).toHaveText('That is not a combination they missed');
    await expect(score(alice, 'Alice')).toHaveText('1'); // a wrong selection costs nothing
    await shownCard(alice, S('K')).click(); // off
    await shownCard(alice, D('8')).click();
    await button(alice, 'Claim these').click();
    await expect(score(alice, 'Alice')).toHaveText('3'); // 1 for the last card and the 2 missed
    await expect(score(bob, 'Bob')).toHaveText('4'); // only what was claimed
    await expect(status(bob)).toHaveText('Alice counts their hand'); // every opponent answered, so the window closed early
  });

  test('Single press: one press takes the whole difference, and a press when nothing was missed costs 2, never below 0', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await twoPlayers(seat, { houseRules: { muggins: true, mugginsStyle: 'single' } });
    await showing(table);
    await claim(bob, 4);
    await expect(alice.locator('.show-breakdown')).toHaveCount(0);
    await button(alice, 'Muggins!').click();
    await expect(score(alice, 'Alice')).toHaveText('3');
    await expect(score(bob, 'Bob')).toHaveText('4');

    await showing(table); // again, with Bob claiming everything
    await claim(bob, 6);
    await button(alice, 'Muggins!').click();
    await expect(score(alice, 'Alice')).toHaveText('0'); // 1 point, less 2, stops at 0
    await expect(score(bob, 'Bob')).toHaveText('6');
  });

  test('Shown total: the breakdown is shown during the window and a press takes the missed points', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await twoPlayers(seat, { houseRules: { muggins: true, mugginsStyle: 'shown' } });
    await showing(table);
    await claim(bob, 4);
    await expect(alice.locator('.show-breakdown')).toHaveText(SIX);
    await button(alice, 'Muggins!').click();
    await expect(score(alice, 'Alice')).toHaveText('3');
    await expect(score(bob, 'Bob')).toHaveText('4');
  });

  test('the 20 second window counts down, and each opponent can answer No Muggins; with 3 players it closes once everyone has', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, ['Alice', 'Bob', 'Cara'], { houseRules: { muggins: true } });
    await table.patch({
      ...base, phase: 'show', dealer: 3, currentPlayer: 1, hands: { 1: [], 2: [], 3: [] }, crib: CRIB, starter: STARTER,
      played: { 1: BOB_HAND, 2: ALICE_HAND, 3: [C('5'), D('5'), H('10'), C('J')] }, shows: [countOf(1, false, BOB_HAND, STARTER)], ...scoresOf({ 1: 0, 2: 0, 3: 0 })
    });
    await claim(alice, 4);
    await expect(bob.locator('.show-clock')).toHaveText(/^(19|20) seconds left$/);
    await button(bob, 'No Muggins').click();
    await expect(bob.locator('.show-press')).toHaveText('No Muggins: Bob');
    await expect(button(bob, 'No Muggins')).toHaveCount(0);
    await expect(button(cara, 'No Muggins')).toBeVisible(); // still open for Cara
    await expect(score(alice, 'Alice')).toHaveText('0');
    await button(cara, 'No Muggins').click();
    await expect(score(alice, 'Alice')).toHaveText('4');
    await expect(status(alice)).toHaveText('Bob counts their hand');
  });

  test('a claim is a whole number from 0 to 29', async ({ seat }) => {
    const { table, pages: [, bob] } = await twoPlayers(seat, { houseRules: { muggins: true } });
    await showing(table);
    const field = bob.getByLabel('Your count');
    await expect(button(bob, 'Claim')).toBeDisabled();
    for (const bad of ['30', '-1', '2.5']) {
      await field.fill(bad);
      await expect(button(bob, 'Claim')).toBeDisabled();
    }
    await field.fill('29');
    await expect(button(bob, 'Claim')).toBeEnabled();
  });

  test('the round summary reads "Claimed X of Y" with who took the rest, and a crib count shows its own breakdown', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await twoPlayers(seat, { houseRules: { muggins: true, mugginsStyle: 'name' } });
    const counted = [
      countOf(2, false, BOB_HAND, STARTER, { claimed: 6 }),
      countOf(1, false, ALICE_HAND, STARTER, { claimed: 7 })
    ];
    await showing(table, { shows: [...counted, countOf(1, true, CRIB, STARTER)], showIndex: 2, currentPlayer: 1, ...scoresOf({ 1: 8, 2: 6 }) });
    await claim(alice, 0);
    await button(bob, 'Muggins!').click();
    await shownCard(bob, C('K')).click();
    await shownCard(bob, D('K')).click();
    await button(bob, 'Claim these').click();
    for (const page of [alice, bob]) {
      const dialog = summary(page);
      await expect(dialog.locator('.summary-count').nth(2)).toContainText("Alice's crib");
      await expect(dialog.locator('.summary-count').nth(2)).toContainText('Claimed 0 of 2. Bob took 2 by Muggins');
      await expect(dialog.locator('.summary-side').filter({ hasText: 'Bob' })).toContainText('8 pts');
    }
  });

  test('a 4-player game is two partnerships across the table sharing one set of pegs', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat, ['Alice', 'Bob', 'Cara', 'Dan']);
    await table.patch({
      ...base, phase: 'pegging', dealer: 4, currentPlayer: 1, crib: CRIB, starter: STARTER, count: 10, pile: [{ seat: 4, card: H('K') }],
      hands: { 1: [D('5'), H('9')], 2: [C('5'), S('3')], 3: [H('5'), H('2')], 4: [C('3'), S('7')] },
      played: { 1: [], 2: [], 3: [], 4: [H('K')] }, ...scoresOf({ 0: 0, 1: 0 })
    });
    await expect(alice.locator('.peg-score').filter({ hasText: 'Alice and Cara' })).toBeVisible();
    await expect(bob.locator('.peg-score').filter({ hasText: 'Bob and Dan' })).toBeVisible();
    await handCard(alice, D('5')).click(); // fifteen
    await handCard(bob, C('5')).click(); // pair
    await handCard(cara, H('5')).click(); // pair royal
    await expect(score(dan, 'Alice and Cara')).toHaveText('8'); // 2 + 6, shared by Alice and Cara
    await expect(score(cara, 'Alice and Cara')).toHaveText('8');
    await expect(score(dan, 'Bob and Dan')).toHaveText('2');
  });

  test('reaching 61 in the short game ends it at once, during the show, on the game-over screen', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await twoPlayers(seat, { houseRules: { targetScore: 61, muggins: true } });
    await showing(table, scoresOf({ 1: 1, 2: 55 }));
    await claim(bob, 6);
    await button(alice, 'No Muggins').click();
    for (const page of [alice, bob]) {
      const dialog = gameOver(page);
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.summary-target')).toHaveText('First to 61 points wins');
      await expect(dialog).toContainText('Claimed 6 of 6');
      await expect(turn(page)).toHaveText('Game over');
      await expect(page.getByText(/Waiting for .* to count/)).toHaveCount(0);
    }
    expect((await table.state<GameState>()).shows).toHaveLength(1); // Alice's count was never reached
  });

  test('Undo takes back a played card', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await twoPlayers(seat);
    await lastCards(table);
    await handCard(bob, S('K')).click();
    await expect(alice.locator('.pile-count')).toHaveText('Count: 10');
    await undo(bob, alice);
    await expect(handCard(bob, S('K'))).toBeEnabled();
    await expect(alice.locator('.pile-count')).toHaveText('Count: 0');
  });

  test('History steps through the plays', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await twoPlayers(seat);
    await pegging(table, { 1: [D('8'), C('6')], 2: [C('7'), S('8')] });
    await handCard(bob, C('7')).click();
    await handCard(alice, D('8')).click();
    await handCard(bob, S('8')).click();
    await (await headerButton(alice, 'History')).click();
    const dialog = alice.getByRole('dialog', { name: 'History' });
    await expect(dialog.locator('.history-move')).toContainText('Move 3 of 3: Bob played the 8 of spades for a pair');
    await dialog.getByRole('slider', { name: 'Step' }).press('ArrowLeft');
    await expect(dialog.locator('.history-move')).toContainText('Move 2 of 3: Alice played the 8 of diamonds for fifteen two');
    await expect(dialog.locator('.pile-count')).toHaveText('Count: 15');
  });

  test('History describes a count under Muggins as "claimed X of Y"', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await twoPlayers(seat, { houseRules: { muggins: true } });
    await showing(table);
    await claim(bob, 4);
    await button(alice, 'No Muggins').click();
    await (await headerButton(alice, 'History')).click();
    await expect(alice.getByRole('dialog', { name: 'History' }).locator('.history-move')).toContainText(`Bob claimed 4 of 6: ${SIX}`);
  });

  test('a player who leaves a 3-player game: the hand is dealt again for the two left, scores kept', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await table.patch({ started: true }); // a seat is held only after the first move
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(status(alice)).toContainText('Cara left, so the cards are dealt again');
    await expect(hand(alice).getByRole('button')).toHaveCount(6);
  });

  test('a player who leaves a 2-player game loses', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await twoPlayers(seat);
    await table.patch({ started: true });
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(gameOver(alice)).toBeVisible();
  });

  test('the pass and play handoff fits a phone without sideways scrolling', async ({ seat, browser, server }) => {
    const table = await seat('cribbage', [], { agree: false });
    const device = await newPlayer(browser, server);
    await device.setViewportSize({ width: 390, height: 844 });
    await joinPassAndPlay(device, 'cribbage', table.gameId, ['Ann', 'Bob']);
    await agreeToHouseRules(device);
    await expect(device.locator('.handoff-banner')).toBeVisible();
    expect(await device.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('FAQ shows the rules and controls', async ({ seat }) => {
    const { pages: [alice] } = await twoPlayers(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('What is Muggins?');
    await expect(faq).toContainText('Name the points');
    await faq.getByRole('button', { name: 'Close' }).click();
    const controls = await openControls(alice);
    await expect(controls).toContainText('Lay cards in the crib');
    await expect(controls).toContainText('click or tap Send to crib');
    await controls.getByRole('button', { name: 'Close' }).click();
  });
});
