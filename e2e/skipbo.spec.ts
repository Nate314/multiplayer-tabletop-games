import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, test, undo, type Seat, type Table } from './fixtures.ts';
import type { Card, GameState } from '../games/skipbo/types.ts';

// One test per rule and control in games/skipbo/README.md. Seats join in order, so Alice is Player 1 and goes first.
// Most tests deal a crafted table over the real deal, so the cards in play are known.

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan', 'Eve', 'Finn'];

// Crafted cards get ids from 1000 up, so they never clash with each other or the real deck
let nextId = 1000;
const num = (value: number): Card => ({ id: nextId++, kind: 'number', value });
const wild = (): Card => ({ id: nextId++, kind: 'skipbo' });
const nums = (...values: number[]) => values.map(num);
const run = (from: number, to: number) => nums(...Array.from({ length: to - from + 1 }, (_, index) => from + index));
const emptyPiles = (): Card[][] => [[], [], [], []];

async function start(seat: Seat, players = 2): Promise<{ table: Table; pages: Page[] }> {
  const table = await seat('skipbo', NAMES.slice(0, players));
  return { table, pages: table.pages };
}

type Craft = Partial<Pick<GameState, 'building' | 'drawPile' | 'turnOf' | 'currentPlayer'>> & {
  hands?: GameState['hands'];
  stocks?: GameState['stocks'];
  discards?: GameState['discards'];
};

// Alice to play with 5, 6, 7, 8, 9 in hand, everyone else's hand empty, each stock 10 then 11 on top,
// empty discard and building piles and twenty 12s to draw. `fields` replaces any of it, seat by seat.
async function craft(table: Table, fields: Craft = {}): Promise<void> {
  const seats = table.pages.map((_, index) => index + 1);
  const perSeat = <T>(make: (seat: number) => T, given: Record<number, T> = {}) =>
    ({ ...Object.fromEntries(seats.map(seat => [seat, make(seat)])), ...given });
  await table.patch({
    building: emptyPiles(),
    drawPile: nums(...Array<number>(20).fill(12)),
    ...fields,
    hands: perSeat(seat => (seat === 1 ? nums(5, 6, 7, 8, 9) : []), fields.hands),
    stocks: perSeat(() => nums(10, 11), fields.stocks),
    discards: perSeat(() => emptyPiles(), fields.discards)
  });
}

const hand = (page: Page) => page.getByRole('region', { name: /^Your hand/ });
const handCard = (page: Page, label: string) => hand(page).getByRole('button', { name: label, exact: true });
const area = (page: Page, name: string) => page.getByRole('region', { name: `${name}'s cards` });
const counts = (page: Page, name: string) => area(page, name).locator('.seat-counts');
const stockTop = (page: Page, name: string) => area(page, name).locator('.stock button');
const discardPile = (page: Page, name: string, pile: number) => area(page, name).locator('.discard-pile').nth(pile);
const building = (page: Page, pile: number) => page.locator('.building-pile').nth(pile);
const drawPile = (page: Page) => page.locator('.draw-pile .pile-label');
const turn = (page: Page) => page.locator('.turn-message');
const status = (page: Page) => page.locator('.game-status');

// Puts the picked hand card on discard pile `pile` (0-3) in the two steps the screen asks for
async function discardTo(page: Page, pile: number): Promise<void> {
  await page.getByRole('button', { name: `Choose discard pile ${pile + 1}` }).click();
  await page.getByRole('button', { name: `Discard here on pile ${pile + 1} and end your turn` }).click();
}

// Discards the lowest card of the hand onto discard pile 1, ending the turn
async function discardLowest(page: Page): Promise<void> {
  await hand(page).getByRole('button').first().click();
  await discardTo(page, 0);
}

test.describe('Skip-Bo rules', () => {
  test('the deck is 162 cards: twelve each of 1 to 12 and 18 wild Skip-Bo cards', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    // 162 less two stocks of 30 and Alice's first hand of 5
    await expect(drawPile(alice)).toHaveText('Draw pile (97)');
    await expect(hand(alice).getByRole('button')).toHaveCount(5);
    const state = await table.state<GameState>();
    const cards = [...Object.values(state.hands).flat(), ...Object.values(state.stocks).flat(), ...state.drawPile];
    expect(cards).toHaveLength(162);
    expect(cards.filter(card => card.kind === 'skipbo')).toHaveLength(18);
    for (let value = 1; value <= 12; value++) {
      expect(cards.filter(card => card.kind === 'number' && card.value === value)).toHaveLength(12);
    }
  });

  test('setup deals 30-card stocks to 2 to 4 players and 20 to 5 or 6, only the top face up, and play goes up through the seats from Player 1', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await start(seat, 3);
    for (const name of ['Alice', 'Bob', 'Cara']) await expect(counts(alice, name)).toContainText('Stock 30');
    // Bob's stock shows a single face-up card, his top
    await expect(area(alice, 'Bob').locator('.stock .card')).toHaveCount(1);
    await expect(area(alice, 'Bob').locator('.stock .card')).not.toHaveClass(/card-empty/);
    await expect(turn(alice)).toHaveText('Alice goes first. Joining closes after the first move.');
    await discardLowest(alice);
    await expect(turn(bob)).toHaveText('Your turn');
    await discardLowest(bob);
    await expect(turn(cara)).toHaveText('Your turn');
    await discardLowest(cara);
    await expect(turn(alice)).toHaveText('Your turn');

    const five = await start(seat, 5);
    for (const name of NAMES.slice(0, 5)) await expect(counts(five.pages[0], name)).toContainText('Stock 20');
    await expect(drawPile(five.pages[0])).toHaveText('Draw pile (57)'); // 162 less 100 in stocks and 5 in Alice's hand
  });

  test('a turn draws up to 5, plays from hand, stock or discard tops, draws 5 more after an emptied hand, and ends with a discard', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await craft(table, {
      hands: { 1: nums(1, 4), 2: nums(9, 9) },
      stocks: { 1: nums(10, 2) },
      discards: { 1: [nums(3), [], [], []] },
      drawPile: run(5, 12)
    });
    // Each play waits for the server's update, which clears the selection, before the next card is picked
    await handCard(alice, '1').click();
    await building(alice, 0).click();
    await expect(building(alice, 0).locator('.pile-label')).toHaveText('Needs 2');
    await stockTop(alice, 'Alice').click();
    await building(alice, 0).click();
    await expect(building(alice, 0).locator('.pile-label')).toHaveText('Needs 3');
    await discardPile(alice, 'Alice', 0).getByRole('button', { name: '3' }).click();
    await building(alice, 0).click();
    await expect(building(alice, 0).locator('.pile-label')).toHaveText('Needs 4');
    // Playing the last hand card draws five more and the turn goes on
    await handCard(alice, '4').click();
    await building(alice, 0).click();
    await expect(hand(alice).getByRole('button')).toHaveCount(5);
    await expect(drawPile(alice)).toHaveText('Draw pile (3)');
    await expect(turn(alice)).toHaveText('Your turn');
    // Bob holds 2, and draws up to 5 as his turn starts
    await expect(counts(alice, 'Bob')).toContainText('Hand 2');
    await discardLowest(alice);
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(hand(bob).getByRole('button')).toHaveCount(5);
    await expect(drawPile(bob)).toHaveText('Draw pile (0)');
  });

  test('building piles start with a 1 or a Skip-Bo, take the next number up, and a 12 sends the pile into the draw pile', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    await craft(table, { hands: { 1: [...nums(2, 1, 12), wild(), num(3)] }, building: [run(1, 11), run(1, 2), [], []], drawPile: nums(12, 12) });
    // A 2 fits no pile: two are past it and two are empty
    await handCard(alice, '2').click();
    await expect(alice.locator('.pile-target')).toHaveCount(0);
    // A 1 starts either empty pile
    await handCard(alice, '1').click();
    await expect(alice.locator('.building-pile.pile-target')).toHaveCount(2);
    await expect(building(alice, 2)).toHaveClass(/pile-target/);
    await expect(building(alice, 3)).toHaveClass(/pile-target/);
    // A 3 goes only on the pile up to 2
    await handCard(alice, '3').click();
    await expect(alice.locator('.building-pile.pile-target')).toHaveCount(1);
    await expect(building(alice, 1)).toHaveClass(/pile-target/);
    // A Skip-Bo fits every pile and counts as the number the pile needs
    await handCard(alice, 'Skip-Bo').click();
    await expect(alice.locator('.building-pile.pile-target')).toHaveCount(4);
    await building(alice, 1).click();
    await expect(building(alice, 1).getByLabel('Skip-Bo as 3')).toBeVisible();
    await expect(building(alice, 1).locator('.pile-label')).toHaveText('Needs 4');
    // The 12 completes the first pile, which is shuffled into the draw pile and leaves its space free
    await handCard(alice, '12').click();
    await building(alice, 0).click();
    await expect(building(alice, 0).locator('.pile-label')).toHaveText('Start with 1');
    await expect(drawPile(alice)).toHaveText('Draw pile (14)');
    await expect(status(alice)).toHaveText('Alice played a 12 from their hand on building pile 1 and completed building pile 1');
  });

  test('discard piles take any hand card in any order only to end the turn, play only their top onto a building pile, and show every card to everyone', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await craft(table, { discards: { 1: [nums(3, 9, 1), [], [], nums(2)] } });
    // Only the top of a pile can be picked
    const first = discardPile(alice, 'Alice', 0);
    await expect(first.getByRole('button')).toHaveCount(1);
    await expect(first.getByRole('button')).toHaveAccessibleName('1');
    // A discard top goes only onto a building pile: no discard pile offers to take it
    await first.getByRole('button').click();
    await expect(alice.locator('.building-pile.pile-target')).toHaveCount(4);
    await expect(alice.getByRole('button', { name: /^Choose discard pile/ })).toHaveCount(0);
    // Nor can the stock top be discarded
    await stockTop(alice, 'Alice').click();
    await expect(alice.getByRole('button', { name: /^Choose discard pile/ })).toHaveCount(0);
    // A 9 goes on a pile topped by a 2, and the discard ends the turn
    await handCard(alice, '9').click();
    await expect(alice.getByRole('button', { name: /^Choose discard pile/ })).toHaveCount(4);
    await discardTo(alice, 3);
    await expect(turn(bob)).toHaveText('Your turn');
    // Bob sees every card in Alice's discard piles
    await expect(discardPile(bob, 'Alice', 0).locator('.card')).toHaveCount(3);
    for (const label of ['3', '9', '1']) await expect(discardPile(bob, 'Alice', 0).getByLabel(label, { exact: true })).toBeVisible();
    await expect(discardPile(bob, 'Alice', 3).locator('.card')).toHaveCount(2);
  });

  test('the first player to play the last card of their stock wins at once, with no points', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await craft(table, { stocks: { 1: nums(1) } });
    await stockTop(alice, 'Alice').click();
    await building(alice, 0).click();
    await expect(status(bob)).toHaveText('Alice played the last card of their stock and wins!');
    await expect(turn(bob)).toHaveText('Game over');
    await expect(area(bob, 'Alice')).toHaveClass(/seat-winner/);
    await expect(bob.getByText(/points/i)).toHaveCount(0);
  });

  test('an empty draw pile gives what is left, an empty hand ends with End turn, and when nobody can ever play the fewest stock cards win', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    // Two cards left to draw: Bob gets just those
    await craft(table, { hands: { 1: nums(9) }, drawPile: nums(6, 7) });
    await discardLowest(alice);
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(hand(bob).getByRole('button')).toHaveCount(2);
    await expect(drawPile(bob)).toHaveText('Draw pile (0)');

    // Now nobody holds a card or can draw one, and no stock or discard top fits
    const stuck = await start(seat);
    const [alice2, bob2] = stuck.pages;
    await craft(stuck.table, { hands: { 1: [] }, drawPile: [], stocks: { 1: nums(5, 6), 2: nums(5, 6, 7) } });
    await alice2.getByRole('button', { name: 'End turn' }).click();
    await expect(turn(bob2)).toHaveText('Your turn');
    await expect(turn(alice2)).toHaveText("Bob's turn"); // one stuck turn is not enough
    await bob2.getByRole('button', { name: 'End turn' }).click();
    await expect(status(bob2)).toHaveText('Nobody can play. Alice wins with the fewest stock cards left.');
    await expect(turn(alice2)).toHaveText('Game over');
  });

  test('you see your hand, every stock top and size, every discard pile and the building piles, but not other hands, cards under a stock top or the draw pile', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await craft(table, {
      hands: { 1: nums(1, 2, 3, 4, 5), 2: nums(12, 12, 12, 12, 12) },
      stocks: { 1: nums(6), 2: nums(7, 8, 9) },
      discards: { 2: [nums(10), [], [], []] },
      building: [nums(1), [], [], []],
      drawPile: nums(11, 11, 11)
    });
    await expect(hand(alice).getByRole('button')).toHaveCount(5);
    await expect(counts(alice, 'Bob')).toHaveText('Hand 5 · Stock 3');
    await expect(area(alice, 'Bob').locator('.stock').getByLabel('9', { exact: true })).toBeVisible();
    await expect(discardPile(alice, 'Bob', 0).getByLabel('10', { exact: true })).toBeVisible();
    await expect(building(alice, 0).getByLabel('1', { exact: true })).toBeVisible();
    // Bob's hand of 12s, the 7 and 8 under his stock top, and the 11s to draw are nowhere on Alice's page
    for (const hidden of ['12', '7', '8', '11']) await expect(alice.getByLabel(hidden, { exact: true })).toHaveCount(0);
    await expect(hand(bob).getByLabel('12', { exact: true })).toHaveCount(5);
  });

  test('a disconnected player keeps their seat and turn; a dismissed one has their cards shuffled into the draw pile and is skipped, and the last player left wins', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, 3);
    await craft(table, { drawPile: nums(...Array<number>(20).fill(12)), stocks: { 2: nums(10, 11, 12) } });
    await discardLowest(alice);
    await expect(counts(alice, 'Bob')).toHaveText('Hand 5 · Stock 3'); // Bob's turn started: 15 left to draw
    await leave(bob);
    await expect(alice.getByText('Waiting for Bob to reconnect')).toBeVisible();
    await expect(turn(alice)).toHaveText("Bob's turn");
    await expect(area(alice, 'Bob')).toBeVisible();
    await dismiss('Bob', alice, cara);
    // Bob's 5 in hand and 3 in stock go to the draw pile, then Cara draws her 5: 15 + 8 - 5
    await expect(turn(cara)).toHaveText('Your turn');
    await expect(hand(cara).getByRole('button')).toHaveCount(5);
    await expect(drawPile(alice)).toHaveText('Draw pile (18)');
    await expect(area(alice, 'Bob')).toHaveCount(0);
    await discardLowest(cara);
    await expect(turn(alice)).toHaveText('Your turn'); // Bob's seat is skipped

    const pair = await start(seat);
    const [alice2, bob2] = pair.pages;
    await discardLowest(alice2);
    await leave(bob2);
    await dismiss('Bob', alice2);
    await expect(status(alice2)).toHaveText('Alice wins! Everyone else left.');
  });

  test('an undo needs the approval of every player still in the game', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, 3);
    await craft(table, { hands: { 1: nums(1, 5, 6, 7, 8) } });
    await handCard(alice, '1').click();
    await building(alice, 0).click();
    await expect(building(alice, 0).locator('.pile-label')).toHaveText('Needs 2');

    await alice.getByRole('button', { name: 'Undo' }).click();
    await bob.getByRole('button', { name: 'Approve' }).click();
    await cara.getByRole('button', { name: 'Decline' }).click();
    await expect(status(alice)).toHaveText('Cara declined the undo');
    await expect(building(alice, 0).locator('.pile-label')).toHaveText('Needs 2');

    await undo(alice, bob, cara);
    await expect(building(alice, 0).locator('.pile-label')).toHaveText('Start with 1');
    await expect(handCard(alice, '1')).toBeVisible();
  });
});

test.describe('Skip-Bo controls', () => {
  test('clicking a hand card, the stock top or a discard top picks it and outlines the building piles it fits; clicking one plays it there', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    await craft(table, { hands: { 1: nums(1, 6, 7, 8, 9) }, building: [[], run(1, 4), [], []], stocks: { 1: nums(10, 2) }, discards: { 1: [nums(5), [], [], []] } });
    await handCard(alice, '1').click();
    await expect(handCard(alice, '1')).toHaveClass(/card-selected/);
    await expect(alice.locator('.building-pile.pile-target')).toHaveCount(3);
    await expect(building(alice, 1)).toBeDisabled();
    await building(alice, 0).click();
    await expect(building(alice, 0).getByLabel('1', { exact: true })).toBeVisible();
    await stockTop(alice, 'Alice').click();
    await expect(alice.locator('.building-pile.pile-target')).toHaveCount(1);
    await building(alice, 0).click();
    await expect(counts(alice, 'Alice')).toContainText('Stock 1');
    await discardPile(alice, 'Alice', 0).getByRole('button', { name: '5' }).click();
    await expect(building(alice, 1)).toHaveClass(/pile-target/);
    await building(alice, 1).click();
    await expect(building(alice, 1).locator('.pile-label')).toHaveText('Needs 6');
  });

  test('a picked hand card shows a Pile button on each discard pile; choosing one and clicking Discard here discards it and ends the turn', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await craft(table);
    await handCard(alice, '7').click();
    const choices = area(alice, 'Alice').getByRole('button', { name: /^Choose discard pile/ });
    await expect(choices).toHaveText(['Pile 1', 'Pile 2', 'Pile 3', 'Pile 4']);
    await alice.getByRole('button', { name: 'Choose discard pile 2' }).click();
    await expect(discardPile(alice, 'Alice', 1)).toHaveClass(/pile-target/);
    await expect(discardPile(alice, 'Alice', 1).getByRole('button', { name: /Discard here/ })).toHaveText('Discard here');
    await expect(turn(alice)).toHaveText(/goes first/); // nothing is discarded yet
    await discardPile(alice, 'Alice', 1).getByRole('button', { name: /Discard here/ }).click();
    await expect(discardPile(bob, 'Alice', 1).getByLabel('7', { exact: true })).toBeVisible();
    await expect(status(alice)).toHaveText('Alice discarded a 7 on discard pile 2');
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('clicking the picked card again or Put back unpicks it, and clicking the stock top or a discard top switches the pick', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    await craft(table, { discards: { 1: [nums(3), [], [], []] } });
    await handCard(alice, '5').click();
    await expect(handCard(alice, '5')).toHaveAttribute('aria-pressed', 'true');
    await handCard(alice, '5').click();
    await expect(handCard(alice, '5')).toHaveAttribute('aria-pressed', 'false');
    await expect(alice.getByRole('button', { name: 'Put back' })).toHaveCount(0);

    await handCard(alice, '6').click();
    await alice.getByRole('button', { name: 'Put back' }).click();
    await expect(handCard(alice, '6')).toHaveAttribute('aria-pressed', 'false');

    await handCard(alice, '6').click();
    await stockTop(alice, 'Alice').click();
    await expect(handCard(alice, '6')).toHaveAttribute('aria-pressed', 'false');
    await expect(stockTop(alice, 'Alice')).toHaveAttribute('aria-pressed', 'true');
    const discardTop = discardPile(alice, 'Alice', 0).getByRole('button', { name: '3' });
    await discardTop.click();
    await expect(discardTop).toHaveAttribute('aria-pressed', 'true');
    await expect(stockTop(alice, 'Alice')).toHaveAttribute('aria-pressed', 'false');
  });

  test('End turn appears only with no cards in hand and none to draw', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await craft(table, { drawPile: [] });
    await expect(alice.getByRole('button', { name: 'End turn' })).toHaveCount(0);
    await craft(table, { hands: { 1: [] }, drawPile: [] });
    await expect(alice.locator('.hint')).toHaveText('No cards to draw: play from your stock or discard piles, then End turn');
    await alice.getByRole('button', { name: 'End turn' }).click();
    await expect(status(bob)).toHaveText('Alice had no cards to discard and ended their turn');
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('each building pile shows its top card, a Skip-Bo with the number it stands for, and what it needs next; the draw pile shows its count', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    await craft(table, { building: [run(1, 5), [...run(1, 6), wild()], [], []], drawPile: nums(12, 12, 12, 12, 12, 12, 12) });
    await expect(building(alice, 0).getByLabel('5', { exact: true })).toBeVisible();
    await expect(building(alice, 0).locator('.pile-label')).toHaveText('Needs 6');
    await expect(building(alice, 1).getByLabel('Skip-Bo as 7')).toBeVisible();
    await expect(building(alice, 1).locator('.card-stands-for')).toHaveText('7');
    await expect(building(alice, 1).locator('.pile-label')).toHaveText('Needs 8');
    await expect(building(alice, 2).locator('.pile-label')).toHaveText('Start with 1');
    await expect(drawPile(alice)).toHaveText('Draw pile (7)');
  });

  test('every player shows their hand size, stock size and top and four discard piles; the player to move is outlined, and the winner at the end', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, 3);
    await craft(table, { hands: { 2: nums(3, 4) }, stocks: { 1: nums(1), 3: nums(4, 5, 6) } });
    await expect(counts(alice, 'Bob')).toHaveText('Hand 2 · Stock 2');
    await expect(counts(alice, 'Cara')).toHaveText('Hand 0 · Stock 3');
    await expect(area(alice, 'Cara').locator('.stock').getByLabel('6', { exact: true })).toBeVisible();
    for (const name of ['Alice', 'Bob', 'Cara']) await expect(area(bob, name).locator('.discard-pile')).toHaveCount(4);
    await expect(area(cara, 'Alice')).toHaveClass(/seat-current/);
    await expect(area(cara, 'Bob')).not.toHaveClass(/seat-current/);
    await stockTop(alice, 'Alice').click();
    await building(alice, 0).click();
    await expect(area(cara, 'Alice')).toHaveClass(/seat-winner/);
    await expect(area(cara, 'Bob')).not.toHaveClass(/seat-winner/);
  });

  test('clicking Undo asks everyone to undo the last move', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await start(seat, 3);
    await discardLowest(alice);
    await bob.getByRole('button', { name: 'Undo' }).click();
    await expect(alice.getByText('Bob wants to undo the last turn').first()).toBeVisible();
    await expect(alice.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(cara.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(bob.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { pages: [alice] } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('162 cards');
    await expect(faq).toContainText('Discard here');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Skip-Bo differences from Wikipedia', () => {
  test('Player 1, the first to join, goes first', async ({ seat }) => {
    const { pages: [alice, bob] } = await start(seat);
    await expect(turn(bob)).toHaveText('Alice goes first. Joining closes after the first move.');
    await expect(hand(alice).getByRole('button').first()).toBeEnabled();
  });

  test('each player draws their 5 cards as their own first turn starts, so others hold none before it', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await start(seat, 3);
    await expect(counts(cara, 'Alice')).toContainText('Hand 5');
    await expect(counts(cara, 'Bob')).toContainText('Hand 0');
    await expect(hand(cara).locator('.hand-empty')).toHaveText('No cards');
    await discardLowest(alice);
    await expect(counts(cara, 'Bob')).toContainText('Hand 5');
    await expect(counts(cara, 'Cara')).toContainText('Hand 0');
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('a completed pile is shuffled into the draw pile at once', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    const pile = run(1, 11);
    const twelve = num(12);
    await craft(table, { hands: { 1: [twelve, ...nums(5, 6, 7, 8)] }, building: [pile, [], [], []], drawPile: nums(9, 9, 9) });
    await handCard(alice, '12').click();
    await building(alice, 0).click();
    await expect(drawPile(alice)).toHaveText('Draw pile (15)');
    const ids = (await table.state<GameState>()).drawPile.map(card => card.id);
    for (const card of [...pile, twelve]) expect(ids).toContain(card.id);
  });

  test('every player plays alone, 2 to 6 players, in a single round', async ({ seat }) => {
    // The lobby offers 2 to 6 players (a lone player leaving the lobby frees nothing that matters)
    const solo = await seat('skipbo', ['Gus']);
    await solo.pages[0].getByRole('button', { name: 'Back to games' }).click();
    const card = solo.pages[0].locator('.lobby-game').filter({ hasText: 'Skip-Bo' });
    await expect(card.locator('.lobby-game-players')).toHaveText('2 to 6 players');

    const { table, pages: [alice, bob] } = await start(seat);
    await expect(bob.getByRole('region', { name: /'s cards$/ })).toHaveCount(2); // one area per player, no teams
    // The first stock emptied ends the game, with nothing dealt again
    await craft(table, { hands: { 1: nums(9), 2: nums(9) }, stocks: { 2: nums(1) } });
    await discardLowest(alice);
    await stockTop(bob, 'Bob').click();
    await building(bob, 0).click();
    await expect(turn(bob)).toHaveText('Game over');
    await expect(status(bob)).toHaveText('Bob played the last card of their stock and wins!');
  });

  test('when nobody can play, tied players share the win', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await craft(table, { hands: { 1: [] }, drawPile: [], stocks: { 1: nums(5, 6), 2: nums(7, 8) } });
    await alice.getByRole('button', { name: 'End turn' }).click();
    await bob.getByRole('button', { name: 'End turn' }).click();
    await expect(status(alice)).toHaveText('Nobody can play. Alice and Bob win with the fewest stock cards left.');
    await expect(area(alice, 'Alice')).toHaveClass(/seat-winner/);
    await expect(area(alice, 'Bob')).toHaveClass(/seat-winner/);
  });

  test('a player who leaves has their cards shuffled into the draw pile', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, 3);
    await craft(table, { drawPile: nums(12, 12, 12), stocks: { 3: nums(4, 4, 4, 4) }, discards: { 3: [nums(2, 2), [], [], []] } });
    await discardLowest(alice);
    await expect(turn(bob)).toHaveText('Your turn');
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(area(alice, 'Cara')).toHaveCount(0);
    // Cara held no hand yet: her 4 stock cards and 2 discards join the empty draw pile
    await expect(drawPile(alice)).toHaveText('Draw pile (6)');
  });
});
