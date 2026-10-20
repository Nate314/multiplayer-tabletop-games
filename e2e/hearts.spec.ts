import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, test, undo, type Seat, type Table } from './fixtures.ts';
import { cardName, type Rank, type Suit } from '../shared/playingCards.ts';
import type { GameState, PlayingCard } from '../games/hearts/types.ts';

// One test per rule, control and difference in games/hearts/README.md. Seats join in order: Alice 1, Bob 2, Cara 3,
// Dan 4, and Bob is to Alice's left.

const c = (rank: Rank, suit: Suit): PlayingCard => ({ rank, suit });
const club = (rank: Rank) => c(rank, 'clubs');
const diamond = (rank: Rank) => c(rank, 'diamonds');
const heart = (rank: Rank) => c(rank, 'hearts');
const spade = (rank: Rank) => c(rank, 'spades');
const QS = spade('Q');
const zero = { 1: 0, 2: 0, 3: 0, 4: 0 };

async function start(seat: Seat): Promise<{ table: Table; pages: Page[] }> {
  const table = await seat('hearts', ['Alice', 'Bob', 'Cara', 'Dan']);
  return { table, pages: table.pages };
}

// A hand under way after the first trick, hearts not broken, Alice to lead
async function playing(table: Table, hands: Record<number, PlayingCard[]>, fields: Partial<GameState> = {}): Promise<void> {
  await table.patch({
    started: true,
    phase: 'play',
    currentPlayer: 1,
    hands,
    passes: {},
    trick: [],
    lastTrick: null,
    tricksPlayed: 1,
    heartsBroken: false,
    taken: zero,
    roundSummary: null,
    lastMove: null,
    ...fields
  });
}

// The last trick of a hand: Bob's ace of clubs takes two hearts. Before it the players had taken `taken`.
async function lastTrick(table: Table, scores: Record<number, number>, taken: Record<number, number> = zero): Promise<void> {
  await playing(table, { 1: [club('5')], 2: [club('A')], 3: [heart('2')], 4: [heart('3')] },
    { tricksPlayed: 12, heartsBroken: true, scores, taken });
}

async function playLastTrick(pages: Page[]): Promise<void> {
  const cards = [club('5'), club('A'), heart('2'), heart('3')];
  for (const [index, page] of pages.entries()) await handCard(page, cards[index]).click();
}

const hand = (page: Page) => page.getByRole('region', { name: 'Your hand' });
const handCard = (page: Page, card: PlayingCard) => hand(page).getByRole('button', { name: cardName(card), exact: true });
const position = (page: Page, where: 'bottom' | 'left' | 'top' | 'right') => page.locator(`.seats .seat-${where}`);
const seatOf = (page: Page, name: string) => page.locator('.seats .seat').filter({ hasText: name });
const score = (page: Page, name: string) => page.locator('.scoreboard .score').filter({ hasText: name });
const turn = (page: Page) => page.locator('.turn-message');
const hint = (page: Page) => page.locator('.hint');
const status = (page: Page) => page.locator('.game-status');
const scoring = (page: Page) => page.getByRole('dialog', { name: 'Hand scoring' });
const passButton = (page: Page) => page.getByRole('button', { name: /^Pass \d\/3$/ });

// Picks the first three cards of the hand and passes them
async function passFirstThree(page: Page): Promise<void> {
  for (let index = 0; index < 3; index++) await hand(page).getByRole('button').nth(index).click();
  await passButton(page).click();
}

test.describe('Hearts rules', () => {
  test('four players each for themselves, all 52 cards dealt 13 each, ace high and no trump', async ({ seat }) => {
    const { table, pages } = await start(seat);
    for (const page of pages) await expect(hand(page).getByRole('button')).toHaveCount(13);
    const state = await table.state<GameState>();
    expect(new Set(Object.values(state.hands).flat().map(cardName)).size).toBe(52);
    await expect(pages[0].locator('.scoreboard .score')).toHaveCount(4);

    // A spade played off-suit does not win: the ace of clubs does
    const [alice, bob, cara, dan] = pages;
    await playing(table, { 1: [club('K'), club('2')], 2: [club('A'), club('3')], 3: [spade('A'), diamond('3')], 4: [club('Q'), club('4')] });
    await handCard(alice, club('K')).click();
    await handCard(bob, club('A')).click();
    await handCard(cara, spade('A')).click();
    await handCard(dan, club('Q')).click();
    await expect(alice.locator('.trick-taken')).toHaveText('Bob took the trick');
  });

  test('everyone passes three cards at once, left then right then across then none, and they arrive only once all four have passed; joining then closes', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara, dan] = pages;
    const before = await table.state<GameState>();
    const sent = before.hands[1].slice(0, 3);
    await expect(alice.locator('.hand-info')).toContainText('Pass: left');
    await passFirstThree(alice);
    await expect(hand(alice).getByRole('button')).toHaveCount(10);
    await expect(hand(bob).getByRole('button')).toHaveCount(13);
    for (const card of sent) await expect(handCard(bob, card)).toHaveCount(0);
    await passFirstThree(bob);
    await passFirstThree(cara);
    await expect(turn(dan)).toHaveText('Passing. Joining closes once everyone has passed.');
    await passFirstThree(dan);
    for (const card of sent) await expect(handCard(bob, card)).toBeVisible();
    await expect(hand(alice).getByRole('button')).toHaveCount(13);
    const late = await table.join('Eve').catch(() => null);
    expect(late).toBeNull();

    // Hands two, three and four pass right, across and not at all
    for (const [handNumber, text] of [[2, 'Pass: right'], [3, 'Pass: across'], [4, 'No pass this hand']] as const) {
      await table.patch({ handNumber });
      await expect(alice.locator('.hand-info')).toContainText(text);
    }
  });

  test('the 2 of clubs leads the first trick, and nobody may play a heart or the queen of spades on it unless they have nothing else', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await playing(table, {
      1: [club('2'), club('9')],
      2: [diamond('4'), heart('5'), QS],
      3: [heart('6'), QS],
      4: [club('8'), heart('7')]
    }, { tricksPlayed: 0 });
    await expect(hint(alice)).toHaveText('Lead the 2 of clubs');
    await expect(handCard(alice, club('9'))).toBeDisabled();
    await handCard(alice, club('2')).click();
    await expect(handCard(bob, heart('5'))).toBeDisabled();
    await expect(handCard(bob, QS)).toBeDisabled();
    await handCard(bob, diamond('4')).click();
    // Cara has only penalty cards, so either may go
    await expect(handCard(cara, heart('6'))).toBeEnabled();
    await expect(handCard(cara, QS)).toBeEnabled();
    await handCard(cara, heart('6')).click();
    await expect(handCard(dan, heart('7'))).toBeDisabled(); // he holds a club
  });

  test('players follow the suit led if they can or play anything, the highest of the suit led takes it, and its winner leads next', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await playing(table, { 1: [club('5'), diamond('2')], 2: [club('9'), diamond('3')], 3: [club('3'), diamond('4')], 4: [spade('K'), diamond('5')] });
    await handCard(alice, club('5')).click();
    await expect(handCard(bob, diamond('3'))).toBeDisabled();
    await handCard(bob, club('9')).click();
    await handCard(cara, club('3')).click();
    await expect(handCard(dan, diamond('5'))).toBeEnabled(); // no clubs, so anything
    await handCard(dan, spade('K')).click();
    await expect(alice.locator('.trick-taken')).toHaveText('Bob took the trick');
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(hint(bob)).toHaveText('Lead a card');
  });

  test('a heart cannot be led until a heart has been played, unless the hand is all hearts', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await playing(table, { 1: [club('5'), heart('5')], 2: [club('9'), club('2')], 3: [club('3'), club('4')], 4: [heart('9'), diamond('5')] });
    await expect(alice.locator('.hearts-broken')).toHaveText('Hearts not broken');
    await expect(handCard(alice, heart('5'))).toBeDisabled();
    await handCard(alice, club('5')).click();
    await handCard(bob, club('9')).click();
    await handCard(cara, club('3')).click();
    await handCard(dan, heart('9')).click();
    await expect(alice.locator('.hearts-broken')).toHaveText('Hearts broken');
    await expect(handCard(bob, club('2'))).toBeEnabled();

    await playing(table, { 1: [heart('5'), heart('6')], 2: [club('2')], 3: [club('3')], 4: [club('4')] });
    await expect(handCard(alice, heart('5'))).toBeEnabled();
  });

  test('each heart is 1 point and the queen of spades 13; taking all 26 shoots the moon; the next hand waits for every connected player to Continue', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara, dan] = pages;
    await playing(table, { 1: [club('5'), club('2')], 2: [club('A'), club('3')], 3: [heart('2'), diamond('3')], 4: [QS, diamond('4')] });
    await handCard(alice, club('5')).click();
    await handCard(bob, club('A')).click();
    await handCard(cara, heart('2')).click();
    await handCard(dan, QS).click();
    await expect(score(alice, 'Bob').locator('.score-taken')).toHaveText('14 this hand');

    await lastTrick(table, { 1: 10, 2: 20, 3: 30, 4: 40 }, { 1: 0, 2: 24, 3: 0, 4: 0 });
    await playLastTrick(pages);
    await expect(scoring(alice).locator('.summary-result')).toHaveText('Bob shot the moon: everyone else takes 26');
    await expect(scoring(alice).locator('.summary-player').nth(1)).toContainText('took 26: +0');
    await expect(scoring(alice).locator('.summary-player').nth(0)).toContainText('36 pts');
    await scoring(alice).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(alice).locator('.summary-waiting')).toHaveText('Waiting for Bob, Cara, Dan');
    await scoring(bob).getByRole('button', { name: 'Continue' }).click();
    await scoring(cara).getByRole('button', { name: 'Continue' }).click();
    await leave(dan);
    await expect(alice.locator('.hand-info')).toContainText('Hand 2');
    await expect(alice.locator('.hand-info')).toContainText('Pass: right');
  });

  test('the game ends once someone reaches 100, the lowest score wins and equal lowest scores share', async ({ seat }) => {
    const short = await start(seat);
    await lastTrick(short.table, { 1: 50, 2: 97, 3: 60, 4: 70 }); // Bob reaches 99
    await playLastTrick(short.pages);
    await expect(turn(short.pages[0])).toHaveText('The hand is over');

    const won = await start(seat);
    await lastTrick(won.table, { 1: 50, 2: 98, 3: 60, 4: 70 });
    await playLastTrick(won.pages);
    await expect(status(won.pages[0])).toHaveText('Alice wins with 50 points!');
    await expect(turn(won.pages[0])).toHaveText('Game over');
    await expect(score(won.pages[0], 'Alice')).toHaveClass(/score-winner/);

    const tied = await start(seat);
    await lastTrick(tied.table, { 1: 50, 2: 98, 3: 50, 4: 70 });
    await playLastTrick(tied.pages);
    await expect(status(tied.pages[0])).toHaveText('Alice and Cara share the win with 50 points!');
  });

  test('you see only your own hand and the cards you passed; who passed, points taken and scores are shown, and the History dialog shows no cards', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    const state = await table.state<GameState>();
    for (const card of [...state.hands[2], ...state.hands[3], ...state.hands[4]]) {
      await expect(alice.getByLabel(cardName(card), { exact: true })).toHaveCount(0);
    }
    for (const name of ['Bob', 'Cara', 'Dan']) await expect(seatOf(alice, name).locator('.seat-count')).toHaveText('13 cards, 0 points');
    await passFirstThree(bob);
    await expect(seatOf(alice, 'Bob').locator('.seat-note')).toHaveText('passed');
    await expect(seatOf(alice, 'Cara').locator('.seat-note')).toHaveText('choosing');
    await expect(bob.locator('.my-pass .playing-card')).toHaveCount(3);
    await expect(alice.locator('.my-pass')).toHaveCount(0);

    for (const page of [alice, cara, dan]) await passFirstThree(page);
    await expect(turn(alice)).not.toHaveText(/Passing/);
    await alice.getByRole('button', { name: 'History' }).click();
    const history = alice.getByRole('dialog', { name: 'History' });
    await expect(history).toBeVisible();
    await expect(history.locator('.playing-card')).toHaveCount(0);
  });

  test('a disconnected player keeps their seat and the game waits for their pass; a dismissed player ends the game and the lowest score among the rest wins', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    for (const page of [alice, bob, cara, dan]) await passFirstThree(page);
    // The second hand's pass, with Bob gone before passing
    await table.patch({ handNumber: 2, phase: 'passing', currentPlayer: null, scores: { 1: 30, 2: 5, 3: 20, 4: 20 } });
    await leave(bob);
    await expect(alice.getByText('Bob (disconnected)')).toBeVisible();
    await passFirstThree(alice);
    await expect(hint(alice)).toHaveText('Waiting for Bob, Cara, Dan to pass');
    await dismiss('Bob', alice, cara, dan);
    await expect(status(alice)).toHaveText('Bob left, so the game ends: Cara and Dan share the win with 20 points!');
    await expect(turn(cara)).toHaveText('Game over');
  });

  test('an undo needs every connected player, only while all four seats are filled, and goes back past Continue', async ({ seat }) => {
    const { table, pages } = await start(seat);
    const [alice, bob, cara, dan] = pages;
    await lastTrick(table, zero);
    await playLastTrick(pages);
    for (const page of pages) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(alice.locator('.hand-info')).toContainText('Hand 2');
    await undo(alice, bob, cara, dan);
    await expect(alice.locator('.hand-info')).toContainText('Hand 1');
    await expect(handCard(dan, heart('3'))).toBeEnabled();

    await leave(bob);
    await expect(alice.getByText('Bob (disconnected)')).toBeVisible();
    await undo(alice, cara, dan);
    await expect(handCard(cara, heart('2'))).toBeEnabled();

    await dismiss('Bob', alice, cara, dan);
    await expect(turn(alice)).toHaveText('Game over');
    await expect(alice.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

test.describe('Hearts controls', () => {
  test('click three cards to pick them, click again to put one back, then Pass 3/3; the cards you passed show below your hand', async ({ seat }) => {
    const { pages: [alice] } = await start(seat);
    const cards = hand(alice).getByRole('button');
    await expect(hint(alice)).toHaveText('Pick three cards to pass to the left, to Bob');
    await expect(passButton(alice)).toHaveText('Pass 0/3');
    await expect(passButton(alice)).toBeDisabled();
    for (let index = 0; index < 3; index++) await cards.nth(index).click();
    await expect(cards.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(cards.nth(3)).toBeDisabled();
    await cards.nth(0).click();
    await expect(cards.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(passButton(alice)).toHaveText('Pass 2/3');
    const picked = await cards.evaluateAll(all => [3, 1, 2].map(index => all[index].getAttribute('aria-label')));
    await cards.nth(3).click();
    await passButton(alice).click();
    const below = alice.locator('.my-pass');
    await expect(below.locator('.my-pass-label')).toHaveText('Passed to Bob (they get them once everyone has passed):');
    for (const name of picked) await expect(below.getByLabel(name!, { exact: true })).toBeVisible();
    await expect(passButton(alice)).toHaveCount(0);
  });

  test('in a trick the cards you may play are raised and outlined, and clicking one plays it', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await playing(table, { 1: [club('5')], 2: [club('9'), diamond('3')], 3: [club('3')], 4: [club('4')] });
    await handCard(alice, club('5')).click();
    const look = await handCard(bob, club('9')).evaluate(element => [getComputedStyle(element).outlineStyle, getComputedStyle(element).transform]);
    expect(look[0]).toBe('solid');
    expect(look[1]).not.toBe('none');
    await expect(handCard(bob, diamond('3'))).toBeDisabled();
    await handCard(bob, club('9')).click();
    await expect(alice.locator('.trick-left').getByLabel('9 of clubs')).toBeVisible();
  });

  test('the table shows scores and points this hand, the hand, its pass and hearts broken, and the seats with you at the bottom and play to your left', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await expect(score(alice, 'Alice (you)').locator('.score-total')).toHaveText('0');
    await expect(alice.locator('.hand-info')).toContainText('Hand 1, game ends at 100');
    await expect(alice.locator('.hand-info')).toContainText('Pass: left');
    await expect(alice.locator('.hearts-broken')).toHaveText('Hearts not broken');
    await expect(position(alice, 'bottom').locator('.seat-name')).toHaveText('Alice (you)');
    await expect(position(alice, 'left').locator('.seat-name')).toHaveText('Bob');
    await expect(position(alice, 'top').locator('.seat-name')).toHaveText('Cara');
    await expect(position(alice, 'right').locator('.seat-name')).toHaveText('Dan');
    await expect(alice.locator('.trick-message')).toHaveText('Everyone passes three cards to the left');

    await playing(table, { 1: [club('5'), club('2')], 2: [club('A'), club('3')], 3: [heart('2'), diamond('3')], 4: [club('4'), diamond('4')] });
    await handCard(alice, club('5')).click();
    await expect(bob.locator('.trick-right').getByLabel('5 of clubs')).toBeVisible();
    await handCard(bob, club('A')).click();
    await handCard(cara, heart('2')).click();
    await handCard(dan, club('4')).click();
    await expect(alice.locator('.trick-taken')).toHaveText('Bob took the trick');
    await expect(alice.locator('.trick .playing-card')).toHaveCount(4);
    await expect(seatOf(alice, 'Bob').locator('.seat-count')).toHaveText('1 card, 1 point');
  });

  test('after a hand click Continue on the scoring screen; after the last hand click Close, and Show Scoring opens it again', async ({ seat }) => {
    const { table, pages } = await start(seat);
    await lastTrick(table, zero);
    await playLastTrick(pages);
    await expect(scoring(pages[0]).locator('h2')).toHaveText('Hand 1 scoring');
    for (const page of pages) await scoring(page).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(pages[0])).toHaveCount(0);

    const final = await start(seat);
    const alice = final.pages[0];
    await lastTrick(final.table, { 1: 10, 2: 98, 3: 20, 4: 30 });
    await playLastTrick(final.pages);
    await expect(scoring(alice).locator('h2')).toHaveText('Final scoring');
    await expect(scoring(alice).getByRole('button', { name: 'Continue' })).toHaveCount(0);
    await scoring(alice).getByRole('button', { name: 'Close' }).click();
    await expect(scoring(alice)).toHaveCount(0);
    await alice.getByRole('button', { name: 'Show Scoring' }).click();
    await expect(scoring(alice)).toContainText('Alice wins with 10 points!');
  });

  test('clicking Undo asks everyone to undo the last card played', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await playing(table, { 1: [club('5')], 2: [club('9')], 3: [club('3')], 4: [club('4')] });
    await handCard(alice, club('5')).click();
    await alice.getByRole('button', { name: 'Undo' }).click();
    for (const page of [bob, cara, dan]) await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { pages: [alice] } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('What is shooting the moon?');
    await expect(faq).toContainText('Passing and Continue are not moves');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Hearts differences from Wikipedia', () => {
  test('the queen of spades counts 13, as in Black Lady', async ({ seat }) => {
    const { table, pages } = await start(seat);
    await playing(table, { 1: [club('5')], 2: [club('A')], 3: [QS], 4: [club('3')] }, { tricksPlayed: 12, heartsBroken: true });
    const cards = [club('5'), club('A'), QS, club('3')];
    for (const [index, page] of pages.entries()) await handCard(page, cards[index]).click();
    await expect(scoring(pages[0]).locator('.summary-player').nth(1)).toContainText('took 13: +13');
  });

  test('the pass goes left, right, across, then none, everyone at once', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    // Bob passes before Alice: nobody waits for a turn
    await passFirstThree(bob);
    await passFirstThree(alice);
    for (const page of [cara, dan]) await passFirstThree(page);
    await table.patch({ handNumber: 2, phase: 'passing', currentPlayer: null });
    await expect(hint(alice)).toHaveText('Pick three cards to pass to the right, to Dan');
    await table.patch({ handNumber: 3 });
    await expect(hint(alice)).toHaveText('Pick three cards to pass across, to Cara');
  });

  test('the 2 of clubs leads, so there is no dealer', async ({ seat }) => {
    const { table, pages } = await start(seat);
    for (const page of pages) await passFirstThree(page);
    const state = await table.state<GameState>();
    const leader = state.currentPlayer ?? 0;
    expect(state.hands[leader].map(cardName)).toContain('2 of clubs');
    await expect(turn(pages[leader - 1])).toHaveText('Your turn');
    await expect(pages[0].getByText(/dealer/i)).toHaveCount(0);
  });

  test('a player with only penalty cards may play one on the first trick, with no misdeal', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await playing(table, { 1: [club('2')], 2: [heart('5'), QS], 3: [club('3')], 4: [club('4')] }, { tricksPlayed: 0 });
    await handCard(alice, club('2')).click();
    await expect(handCard(bob, QS)).toBeEnabled();
    await handCard(bob, QS).click();
    await expect(alice.locator('.trick-left').getByLabel('queen of spades')).toBeVisible();
  });

  test('only a hand of all hearts may lead a heart before hearts are broken; hearts and the queen of spades lead the queen', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    await playing(table, { 1: [heart('5'), QS], 2: [club('2')], 3: [club('3')], 4: [club('4')] });
    await expect(handCard(alice, heart('5'))).toBeDisabled();
    await expect(handCard(alice, QS)).toBeEnabled();
  });

  test('shooting the moon always adds 26 to everyone else', async ({ seat }) => {
    const { table, pages } = await start(seat);
    await lastTrick(table, { 1: 0, 2: 50, 3: 0, 4: 0 }, { 1: 0, 2: 24, 3: 0, 4: 0 });
    await playLastTrick(pages);
    await expect(scoring(pages[0]).locator('.summary-points')).toHaveText(['26 pts', '50 pts', '26 pts', '26 pts']);
    await expect(scoring(pages[0]).getByRole('button', { name: /subtract/i })).toHaveCount(0);
  });

  test('the game ends at 100 and equal lowest scores share the win', async ({ seat }) => {
    const { table, pages } = await start(seat);
    await lastTrick(table, { 1: 40, 2: 98, 3: 40, 4: 40 });
    await playLastTrick(pages);
    await expect(status(pages[0])).toHaveText('Alice, Cara and Dan share the win with 40 points!');
  });

  test('the shuffled deck is split straight into four hands of 13', async ({ seat }) => {
    const { table } = await start(seat);
    const state = await table.state<GameState>();
    for (const player of [1, 2, 3, 4]) expect(state.hands[player]).toHaveLength(13);
  });

  test('a card that breaks a rule cannot be played, so there is no reneging', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await playing(table, { 1: [club('5')], 2: [club('9'), diamond('3')], 3: [club('3')], 4: [club('4')] });
    await handCard(alice, club('5')).click();
    await expect(handCard(bob, diamond('3'))).toBeDisabled();
    await expect(handCard(bob, club('9'))).toBeEnabled();
  });

  test('the last trick taken stays in the middle until the next card is played, and points this hand are shown', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await playing(table, { 1: [club('5'), club('2')], 2: [club('A'), club('3')], 3: [heart('2'), diamond('3')], 4: [club('4'), diamond('4')] });
    await handCard(alice, club('5')).click();
    await handCard(bob, club('A')).click();
    await handCard(cara, heart('2')).click();
    await handCard(dan, club('4')).click();
    await expect(dan.locator('.trick .playing-card')).toHaveCount(4);
    await expect(score(dan, 'Bob').locator('.score-taken')).toHaveText('1 this hand');
    await handCard(bob, club('3')).click();
    await expect(dan.locator('.trick-taken')).toHaveCount(0);
    await expect(dan.locator('.trick .playing-card')).toHaveCount(1);
  });

  test('a player who leaves ends the game and the lowest score among the rest wins', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat);
    await playing(table, { 1: [club('5')], 2: [club('9')], 3: [club('3')], 4: [club('4')] }, { scores: { 1: 30, 2: 10, 3: 5, 4: 20 } });
    await leave(cara);
    await dismiss('Cara', alice, bob, dan);
    await expect(status(bob)).toHaveText('Cara left, so the game ends: Bob wins with 10 points!');
    await expect(score(bob, 'Bob')).toHaveClass(/score-winner/);
  });
});
