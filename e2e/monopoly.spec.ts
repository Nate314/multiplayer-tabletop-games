import type { Page } from '@playwright/test';
import { dismiss, expect, leave, openFaq, test, undo, type Seat, type Table } from './fixtures.ts';
import { BOARD, ownable } from '../games/monopoly/board.ts';
import { DECKS } from '../games/monopoly/cards.ts';
import type { DeckName, GameState } from '../games/monopoly/types.ts';

// One test per rule and control in games/monopoly/README.md, and per bullet of its Differences from Wikipedia.
// Seats are Alice (1), Bob (2), Cara (3) and Dan (4). Each test crafts the table through the test hooks, then plays
// in the browser: Alice usually has the turn, and the dice are queued right before the click that rolls them.

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan'];
const PROPERTIES = BOARD.flatMap((_, space) => ownable(space) ? [space] : []);
const inOrder = () => Array.from({ length: 16 }, (_, index) => index);
// A deck in printed order with `index` on top
const topped = (index: number) => [index, ...inOrder().filter(other => other !== index)];
const ownedBy = (seat: number, spaces: number[]) => Object.fromEntries(spaces.map(space => [space, seat]));
const each = <T>(count: number, value: (seat: number) => T) =>
  Object.fromEntries(Array.from({ length: count }, (_, index) => [index + 1, value(index + 1)]));
const cashOf = (amounts: number[]) => Object.fromEntries(amounts.map((amount, index) => [index + 1, amount]));
// Die faces as the raw numbers the server's random function returns
const faces = (...values: number[]) => values.map(face => (face - 0.5) / 6);

type Fields = Partial<GameState>;
type Game = {
  table: Table;
  pages: Page[];
  count: number;
  // Merges `fields` over the server state and waits until every open page shows it
  sync(fields: Fields): Promise<void>;
  // Resets the table, puts Alice on `from` with the turn, and rolls `dice` from her page
  land(from: number, dice: number[], fields?: Fields): Promise<void>;
};

let tableSet = 0;

// A fresh game under way: everyone on GO with $1500, nothing owned, both decks in printed order, Alice to roll
function fresh(count: number): Fields {
  return {
    started: true,
    cash: each(count, () => 1500),
    positions: each(count, () => 0),
    jailed: {},
    jailCards: each(count, (): DeckName[] => []),
    bankrupt: [],
    owners: {},
    buildings: {},
    mortgaged: [],
    decks: { chance: inOrder(), chest: inOrder() },
    turnHolder: 1,
    currentPlayer: 1,
    canRoll: true,
    doublesRolled: 0,
    dice: null,
    pendingBuy: null,
    auction: null,
    auctionQueue: [],
    debts: [],
    trade: null,
    mortgageDecisions: [],
    drawnCard: null,
    log: [],
    lastMove: null
  };
}

async function prepare(table: Table, fields: Fields = {}): Promise<Game> {
  const { pages } = table;
  const count = pages.length;
  async function sync(more: Fields) {
    const marker = `Table set ${++tableSet}`;
    await table.patch({ ...more, gameStatus: marker });
    for (const page of pages) if (!page.isClosed()) await expect(page.locator('.game-status')).toHaveText(marker);
  }
  async function land(from: number, dice: number[], more: Fields = {}) {
    await sync({ ...fresh(count), positions: { ...each(count, () => 0), 1: from }, ...more });
    await table.dice(...dice);
    await pages[0].getByRole('button', { name: 'Roll the dice' }).click();
  }
  await sync({ ...fresh(count), ...fields });
  return { table, pages, count, sync, land };
}

async function start(seat: Seat, count = 2, fields: Fields = {}): Promise<Game> {
  return prepare(await seat('monopoly', NAMES.slice(0, count)), fields);
}

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const players = (page: Page) => page.getByRole('region', { name: 'Players' });
const row = (page: Page, name: string) => players(page).locator('.player-row', { hasText: name });
const cash = (page: Page, name: string) => row(page, name).locator('.player-cash');
const space = (page: Page, index: number) => page.locator('.board > .space').nth(index);
const token = (page: Page, index: number, name: string) => space(page, index).locator(`.token[title="${name}"]`);
const deed = (page: Page, index: number) => page.getByRole('region', { name: `${BOARD[index].name} title deed` });
const turnPanel = (page: Page) => page.locator('.turn-panel');
const auction = (page: Page) => page.getByRole('region', { name: 'Auction' });
const events = (page: Page) => page.getByRole('region', { name: 'Recent events' });
const status = (page: Page) => page.locator('.game-status');

// Opens the Title Deed of `index` by clicking it on the board
async function openDeed(page: Page, index: number) {
  await space(page, index).click();
  await expect(deed(page, index)).toBeVisible();
  return deed(page, index);
}

async function expectCash(game: Game, amounts: number[], viewer = game.pages[0]) {
  for (const [index, amount] of amounts.entries()) await expect(cash(viewer, NAMES[index])).toHaveText(`$${amount}`);
}

// Fills in and sends a trade offer from `page` through the trade form
type SideChoice = { properties?: string[]; cash?: number; jailCards?: number };
async function offerTrade(page: Page, to: string, give: SideChoice, get: SideChoice = {}) {
  await button(page, 'Propose a trade').click();
  await page.getByLabel('With').selectOption({ label: to });
  for (const [side, choice] of [['You give', give], [`${to} gives`, get]] as const) {
    const group = page.getByRole('group', { name: side });
    for (const property of choice.properties ?? []) await group.getByLabel(property).check();
    if (choice.cash !== undefined) await group.getByLabel(/^Cash/).fill(String(choice.cash));
    if (choice.jailCards !== undefined) await group.getByLabel(/^Jail cards/).fill(String(choice.jailCards));
  }
  await button(page, 'Send offer').click();
}

async function declareBankruptcy(page: Page) {
  await button(page, 'Declare bankruptcy').click();
  await button(page, 'Confirm bankruptcy').click();
}

test.describe('Monopoly rules', () => {
  test('the standard board and its prices, rents and mortgages, with 16 shuffled cards in each deck', async ({ seat }) => {
    const table = await seat('monopoly', ['Alice', 'Bob']);
    const shuffled = await table.state<GameState>();
    for (const deck of ['chance', 'chest'] as const) expect([...shuffled.decks[deck]].sort((a, b) => a - b)).toEqual(inOrder());
    expect(shuffled.decks.chance.join() !== inOrder().join() || shuffled.decks.chest.join() !== inOrder().join()).toBe(true);
    const game = await prepare(table);
    const [alice] = game.pages;

    await expect(alice.locator('.board > .space')).toHaveCount(40);
    await expect(alice.locator('.board').getByRole('button')).toHaveCount(28);
    await expect(space(alice, 1).locator('.space-price')).toHaveText('$60');
    await expect(space(alice, 39).locator('.space-price')).toHaveText('$400');
    await expect(space(alice, 4).locator('.space-price')).toHaveText('$200');
    const boardwalk = await openDeed(alice, 39);
    for (const rent of ['$50', '$200', '$600', '$1400', '$1700', '$2000']) {
      await expect(boardwalk.locator('.deed-rents')).toContainText(rent);
    }
    await expect(boardwalk).toContainText('Mortgage value $200; lifting it costs $220');
    await expect(alice.getByText('Cards left: Chance 16, Community Chest 16')).toBeVisible();
  });

  test('a drawn card goes under its deck, and a kept jail card goes back under it once used', async ({ seat }) => {
    const game = await start(seat);
    const [alice] = game.pages;
    // Chance on top is the $50 dividend
    await game.land(33, [1, 2], { decks: { chance: topped(7), chest: inOrder() } });
    await expect(alice.locator('.drawn-card-text')).toHaveText(DECKS.chance[7].text);
    const drawn = await game.table.state<GameState>();
    expect(drawn.decks.chance).toHaveLength(16);
    expect(drawn.decks.chance.at(-1)).toBe(7);

    await game.land(33, [1, 2], { decks: { chance: topped(8), chest: inOrder() } });
    await expect(alice.getByText('Cards left: Chance 15, Community Chest 16')).toBeVisible();
    await expect(row(alice, 'Alice').locator('.chip-card')).toHaveText('Jail card');
    expect((await game.table.state<GameState>()).decks.chance).not.toContain(8);

    await game.sync({ positions: { 1: 10, 2: 0 }, jailed: { 1: 0 }, canRoll: true, turnHolder: 1, currentPlayer: 1 });
    await button(alice, 'Use jail card').click();
    await expect(alice.getByText('Cards left: Chance 16, Community Chest 16')).toBeVisible();
    await expect(row(alice, 'Alice').locator('.chip-card')).toHaveCount(0);
    expect((await game.table.state<GameState>()).decks.chance.at(-1)).toBe(8);
  });

  test('everyone starts with $1500 on GO, the highest roll goes first, ties roll again, then turns go up the seats', async ({ seat }) => {
    const first = await seat('monopoly', ['Alice', 'Bob']);
    // Cara's join reshuffles both decks (30 numbers), then everyone rolls: Alice and Bob tie on 7, then Bob rolls higher
    await first.random(...Array(30).fill(0), ...faces(3, 4, 5, 2, 1, 1, 1, 2, 6, 5));
    const cara = await first.join('Cara');
    const [alice, bob] = first.pages;
    await expect(status(cara)).toContainText('Highest roll goes first: Alice 7, Bob 7, Cara 2; tie: Alice 3, Bob 11. Bob goes first');
    await expect(bob.locator('.turn-message')).toHaveText('You go first. Joining closes after the first move.');
    await expect(alice.locator('.turn-message')).toHaveText('Bob goes first. Joining closes after the first move.');
    for (const name of ['Alice', 'Bob', 'Cara']) {
      await expect(cash(cara, name)).toHaveText('$1500');
      await expect(token(cara, 0, name)).toBeVisible();
    }

    // 1 and 3 reach Income Tax, which needs no decision
    for (const [page, next] of [[bob, cara], [cara, alice]] as const) {
      await first.dice(1, 3);
      await button(page, 'Roll the dice').click();
      await button(page, 'End turn').click();
      await expect(next.locator('.turn-message')).toHaveText('Your turn');
    }
  });

  test('a roll moves by the total, and passing or landing on GO collects $200', async ({ seat }) => {
    const game = await start(seat);
    const [alice] = game.pages;
    await game.land(38, [2, 3]);
    await expect(token(alice, 3, 'Alice')).toBeVisible();
    await expectCash(game, [1700, 1500]);

    await game.land(35, [2, 3]);
    await expect(token(alice, 0, 'Alice')).toBeVisible();
    await expectCash(game, [1700, 1500]);
  });

  test('doubles roll again after the move, and a third doubles goes straight to Jail without moving', async ({ seat }) => {
    const game = await start(seat);
    const [alice] = game.pages;
    // Alice owns everything, so landing asks nothing of her
    const mine = { owners: ownedBy(1, PROPERTIES) };
    await game.land(0, [3, 3], mine);
    await expect(token(alice, 6, 'Alice')).toBeVisible();
    await expect(button(alice, 'Doubles: roll again')).toBeVisible();
    await expect(button(alice, 'End turn')).toHaveCount(0);

    await game.sync({ ...mine, positions: { 1: 5, 2: 0 }, canRoll: true, doublesRolled: 2 });
    await game.table.dice(1, 1);
    await button(alice, 'Doubles: roll again').click();
    await expect(alice.locator('.in-jail .token[title="Alice"]')).toBeVisible();
    await expect(token(alice, 7, 'Alice')).toHaveCount(0);
    await expect(events(alice)).toContainText('Third doubles in a row');
    await expect(button(alice, 'End turn')).toBeVisible();
  });

  test('landing on a bank property offers to buy it at its price', async ({ seat }) => {
    const game = await start(seat);
    const [alice, bob] = game.pages;
    await game.land(0, [1, 2]);
    await button(alice, 'Buy Baltic Avenue for $60').click();
    await expect(space(bob, 3).locator('.owner-tag')).toHaveText('Alice');
    await expectCash(game, [1440, 1500], bob);

    await game.land(0, [1, 2], { cash: cashOf([50, 1500]) });
    await expect(button(alice, 'Buy Baltic Avenue for $60')).toBeDisabled();
    await expect(button(alice, 'Decline and auction')).toBeEnabled();
  });

  test('a declined property is auctioned to everyone in whole dollars above the high bid, and the last bidder buys', async ({ seat }) => {
    const game = await start(seat, 3);
    const [alice, bob, cara] = game.pages;
    await game.land(0, [1, 2]);
    await button(alice, 'Decline and auction').click();
    for (const page of game.pages) {
      await expect(auction(page)).toContainText('Auction: Baltic Avenue');
      await expect(auction(page)).toContainText('Still bidding: Alice, Bob, Cara');
    }
    await button(bob, '$10').click();
    await expect(auction(alice)).toContainText('High bid $10 by Bob');
    // The lander may bid too
    await auction(alice).getByRole('spinbutton').fill('20');
    await button(alice, 'Bid').click();
    await expect(auction(cara)).toContainText('High bid $20 by Alice');
    await auction(cara).getByRole('spinbutton').fill('20');
    await expect(button(cara, 'Bid')).toBeDisabled();
    await auction(cara).getByRole('spinbutton').fill('1501');
    await expect(button(cara, 'Bid')).toBeDisabled();

    await button(cara, 'Pass').click();
    await expect(auction(cara)).toContainText('You passed');
    await expect(button(cara, 'Pass')).toHaveCount(0);
    await button(bob, '$30').click();
    await button(alice, 'Pass').click();
    await expect(auction(alice)).toHaveCount(0);
    await expect(space(cara, 3).locator('.owner-tag')).toHaveText('Bob');
    await expectCash(game, [1500, 1470, 1500], cara);
    await expect(events(cara)).toContainText('Bob won Baltic Avenue for $30');
  });

  test('if nobody bids, the bank keeps the property', async ({ seat }) => {
    const game = await start(seat, 3);
    const [alice] = game.pages;
    await game.land(0, [1, 2]);
    await button(alice, 'Decline and auction').click();
    for (const page of game.pages) await button(page, 'Pass').click();
    await expect(auction(alice)).toHaveCount(0);
    await expect(events(alice)).toContainText('Nobody bid, so Baltic Avenue stays with the bank');
    await expect(space(alice, 3).locator('.space-price')).toHaveText('$60');
  });

  test('rent is paid on landing: doubled for a whole group, by the deed with buildings, by count for railroads and utilities', async ({ seat }) => {
    const game = await start(seat);
    const [alice] = game.pages;
    // From GO, 1 and 2 reach Baltic Avenue (rent $4)
    const cases: [Fields, number][] = [
      [{ owners: { 3: 2 } }, 4],
      [{ owners: { 1: 2, 3: 2 } }, 8],
      [{ owners: { 1: 2, 3: 2 }, mortgaged: [1] }, 8], // another street of the group mortgaged
      [{ owners: { 1: 2, 3: 2 }, mortgaged: [3] }, 0], // mortgaged property charges nothing
      [{ owners: { 1: 2, 3: 2 }, buildings: { 1: 1, 3: 2 } }, 60],
      [{ owners: { 1: 2, 3: 2 }, buildings: { 1: 4, 3: 5 } }, 450],
      [{ owners: { 3: 2 }, positions: { 1: 0, 2: 10 }, jailed: { 2: 0 } }, 4] // an owner in Jail still collects
    ];
    for (const [fields, rent] of cases) {
      await game.land(0, [1, 2], fields);
      await expect(token(alice, 3, 'Alice')).toBeVisible();
      await expectCash(game, [1500 - rent, 1500 + rent]);
      if (rent === 0) await expect(events(alice)).toContainText('Baltic Avenue is mortgaged, so no rent is due');
    }

    // 2 and 3 reach Reading Railroad
    const railroads = [5, 15, 25, 35];
    for (const [owned, rent] of [[1, 25], [2, 50], [3, 100], [4, 200]]) {
      await game.land(0, [2, 3], { owners: ownedBy(2, railroads.slice(0, owned)) });
      await expectCash(game, [1500 - rent, 1500 + rent]);
    }
    // From Reading Railroad, 3 and 4 reach Electric Company
    await game.land(5, [3, 4], { owners: { 12: 2 } });
    await expectCash(game, [1500 - 28, 1500 + 28]);
    await game.land(5, [3, 4], { owners: { 12: 2, 28: 2 } });
    await expectCash(game, [1500 - 70, 1500 + 70]);
  });

  test('with a whole unmortgaged group you build houses at its house cost, evenly', async ({ seat }) => {
    const game = await start(seat, 2, { owners: ownedBy(1, [1, 3]) });
    const [alice, bob] = game.pages;
    const mediterranean = await openDeed(alice, 1);
    await button(alice, 'Build house').click();
    await expect(space(bob, 1).locator('.house')).toHaveCount(1);
    await expectCash(game, [1450, 1500]);
    await expect(button(alice, 'Build house')).toBeDisabled();
    await expect(button(alice, 'Build house')).toHaveAttribute('title', 'Build evenly: the other streets of the group need a house first');
    await mediterranean.getByRole('button', { name: 'Close the title deed' }).click();
    await openDeed(alice, 3);
    await button(alice, 'Build house').click();
    await expect(space(alice, 3).locator('.house')).toHaveCount(1);

    await game.sync({ owners: { 1: 1, 3: 2 }, buildings: {} });
    await space(alice, 3).click();
    await openDeed(alice, 1);
    await expect(button(alice, 'Build house')).toHaveAttribute('title', 'You need every street of the color group to build');
    await game.sync({ owners: ownedBy(1, [1, 3]), mortgaged: [3] });
    await expect(button(alice, 'Build house')).toHaveAttribute('title', 'Lift every mortgage in the group before building');
  });

  test('a hotel needs four houses on every street of the group and gives those houses back to the bank', async ({ seat }) => {
    // Bob's 24 houses and Alice's 8 use up the bank's 32
    const bobs = { 11: 4, 13: 4, 14: 4, 16: 4, 18: 4, 19: 4 };
    const game = await start(seat, 2, {
      owners: { ...ownedBy(1, [1, 3, 6, 8, 9]), ...ownedBy(2, [11, 13, 14, 16, 18, 19]) },
      buildings: { ...bobs, 1: 4, 3: 3 }
    });
    const [alice] = game.pages;
    await openDeed(alice, 1);
    await expect(button(alice, 'Build hotel')).toHaveAttribute('title', 'Build evenly: the other streets of the group need a house first');
    await game.sync({ buildings: { ...bobs, 1: 4, 3: 4 } });
    await space(alice, 1).click();
    await openDeed(alice, 6);
    await expect(button(alice, 'Build house')).toHaveAttribute('title', 'The bank has no houses left');

    await openDeed(alice, 1);
    await button(alice, 'Build hotel').click();
    await expect(space(alice, 1).locator('.hotel')).toHaveCount(1);
    await expect(space(alice, 1).locator('.house')).toHaveCount(0);
    await expectCash(game, [1450, 1500]);
    await openDeed(alice, 6);
    await expect(button(alice, 'Build house')).toBeEnabled();
  });

  test('the bank has 32 houses and 12 hotels, and nobody builds once they run out', async ({ seat }) => {
    // 31 houses stand on Bob's streets
    const game = await start(seat, 2, {
      owners: { ...ownedBy(1, [1, 3]), ...ownedBy(2, [6, 8, 9, 11, 13, 14, 16, 18, 19]) },
      buildings: { 6: 4, 8: 4, 9: 4, 11: 4, 13: 4, 14: 4, 16: 4, 18: 3 }
    });
    const [alice] = game.pages;
    await openDeed(alice, 1);
    await button(alice, 'Build house').click();
    await expect(space(alice, 1).locator('.house')).toHaveCount(1);
    await openDeed(alice, 3);
    await expect(button(alice, 'Build house')).toHaveAttribute('title', 'The bank has no houses left');

    const hotels = Object.fromEntries([6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24].map(street => [street, 5]));
    await game.sync({
      owners: { ...ownedBy(1, [1, 3]), ...ownedBy(2, [6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24]) },
      buildings: { ...hotels, 1: 4, 3: 4 }
    });
    await expect(button(alice, 'Build hotel')).toHaveAttribute('title', 'The bank has no hotels left');
  });

  test('buildings sell back for half their cost, evenly, and a hotel as four houses or outright when the bank is short', async ({ seat }) => {
    const game = await start(seat, 2, { owners: ownedBy(1, [1, 3]), buildings: { 1: 2, 3: 1 } });
    const [alice] = game.pages;
    await openDeed(alice, 3);
    await expect(button(alice, 'Sell building')).toHaveAttribute('title', 'Sell evenly: sell from the streets of the group with the most buildings first');
    await openDeed(alice, 1);
    await button(alice, 'Sell building').click();
    await expect(space(alice, 1).locator('.house')).toHaveCount(1);
    await expectCash(game, [1525, 1500]);

    await game.sync({ cash: cashOf([1500, 1500]), buildings: { 1: 5, 3: 5 } });
    await button(alice, 'Sell building').click();
    await expect(space(alice, 1).locator('.house')).toHaveCount(4);
    await expectCash(game, [1525, 1500]);

    // 30 houses stand elsewhere, so the bank has only two
    const elsewhere = { 6: 4, 8: 4, 9: 4, 11: 4, 13: 4, 14: 4, 16: 4, 18: 2 };
    await game.sync({ cash: cashOf([1500, 1500]), buildings: { ...elsewhere, 1: 5, 3: 5 } });
    await button(alice, 'Sell building').click();
    await expect(space(alice, 1).locator('.hotel, .house')).toHaveCount(0);
    await expectCash(game, [1625, 1500]);
  });

  test('a property with no buildings in its group mortgages for half its price and lifts for that plus 10%, rounded up', async ({ seat }) => {
    const game = await start(seat, 2, { owners: { ...ownedBy(1, [1, 3]), 37: 1 }, buildings: { 3: 1 } });
    const [alice, bob] = game.pages;
    await openDeed(alice, 1);
    await expect(button(alice, 'Mortgage')).toHaveAttribute('title', 'Sell every building in the color group first');

    await openDeed(alice, 37);
    await button(alice, 'Mortgage').click();
    await expect(space(bob, 37).locator('.owner-tag')).toHaveText('Mortgaged');
    await expectCash(game, [1675, 1500]);
    await expect(deed(alice, 37)).toContainText('Mortgage value $175; lifting it costs $193');
    await button(alice, 'Lift mortgage').click();
    await expect(space(bob, 37).locator('.owner-tag')).toHaveText('Alice');
    await expectCash(game, [1675 - 193, 1500]);
  });

  type CardCase = { index: number; from?: number; dice?: number[]; fields?: Fields; cash: number[]; at: number; jailCard?: boolean };

  async function playCards(game: Game, deck: DeckName, cases: CardCase[], from: number, base: Fields) {
    const [alice] = game.pages;
    for (const card of cases) {
      const decks = { chance: inOrder(), chest: inOrder(), [deck]: topped(card.index) };
      await game.land(card.from ?? from, card.dice ?? [1, 2], { ...base, ...card.fields, decks });
      await expect(alice.locator('.drawn-card-text')).toHaveText(DECKS[deck][card.index].text);
      await expectCash(game, card.cash);
      await expect(token(alice, card.at, 'Alice')).toBeVisible();
      if (card.at === 10) await expect(alice.locator('.in-jail .token[title="Alice"]')).toBeVisible();
      if (card.jailCard) await expect(row(alice, 'Alice').locator('.chip-card')).toHaveText('Jail card');
    }
  }

  test('every Chance card does what it says', async ({ seat }) => {
    test.setTimeout(120_000);
    const game = await start(seat, 3);
    const [alice] = game.pages;
    // From 33, 1 and 2 reach Chance at 36. Bob owns Reading Railroad and Electric Company
    const repairs = { owners: { ...ownedBy(1, [1, 3]), 5: 2, 12: 2 }, buildings: { 1: 5, 3: 4 } };
    await playCards(game, 'chance', [
      { index: 0, cash: [1500, 1500, 1500], at: 39 },
      { index: 1, cash: [1700, 1500, 1500], at: 0 },
      { index: 2, cash: [1700, 1500, 1500], at: 24 },
      { index: 3, cash: [1700, 1500, 1500], at: 11 },
      { index: 4, cash: [1650, 1550, 1500], at: 5 }, // twice the $25 rent
      { index: 5, cash: [1650, 1550, 1500], at: 5 },
      { index: 6, dice: [1, 2, 3, 4], cash: [1630, 1570, 1500], at: 12 }, // ten times a new roll of 7
      { index: 7, cash: [1550, 1500, 1500], at: 36 },
      { index: 8, cash: [1500, 1500, 1500], at: 36, jailCard: true },
      { index: 9, from: 4, cash: [1300, 1500, 1500], at: 4 }, // back from 7 to Income Tax
      { index: 10, cash: [1500, 1500, 1500], at: 10 },
      { index: 11, fields: repairs, cash: [1300, 1500, 1500], at: 36 }, // a hotel and four houses
      { index: 12, cash: [1485, 1500, 1500], at: 36 },
      { index: 13, cash: [1675, 1525, 1500], at: 5 },
      { index: 14, cash: [1400, 1550, 1550], at: 36 },
      { index: 15, cash: [1650, 1500, 1500], at: 36 }
    ], 33, { owners: { 5: 2, 12: 2 } });
    await game.land(33, [1, 2], { owners: { 5: 2, 12: 2 }, decks: { chance: topped(0), chest: inOrder() } });
    await expect(button(alice, 'Buy Boardwalk for $400')).toBeVisible();
  });

  test('every Community Chest card does what it says', async ({ seat }) => {
    test.setTimeout(120_000);
    const game = await start(seat, 3);
    // From 14, 1 and 2 reach Community Chest at 17
    const repairs = { owners: ownedBy(1, [1, 3]), buildings: { 1: 5, 3: 4 } };
    await playCards(game, 'chest', [
      { index: 0, cash: [1700, 1500, 1500], at: 0 },
      { index: 1, cash: [1700, 1500, 1500], at: 17 },
      { index: 2, cash: [1450, 1500, 1500], at: 17 },
      { index: 3, cash: [1550, 1500, 1500], at: 17 },
      { index: 4, cash: [1500, 1500, 1500], at: 17, jailCard: true },
      { index: 5, cash: [1500, 1500, 1500], at: 10 },
      { index: 6, cash: [1600, 1500, 1500], at: 17 },
      { index: 7, cash: [1520, 1500, 1500], at: 17 },
      { index: 8, cash: [1520, 1490, 1490], at: 17 },
      { index: 9, cash: [1600, 1500, 1500], at: 17 },
      { index: 10, cash: [1400, 1500, 1500], at: 17 },
      { index: 11, cash: [1450, 1500, 1500], at: 17 },
      { index: 12, cash: [1525, 1500, 1500], at: 17 },
      { index: 13, fields: repairs, cash: [1225, 1500, 1500], at: 17 }, // $115 a hotel, $40 a house
      { index: 14, cash: [1510, 1500, 1500], at: 17 },
      { index: 15, cash: [1600, 1500, 1500], at: 17 }
    ], 14, {});
  });

  test('Income Tax is $200 and Luxury Tax $100 to the bank, and Free Parking pays nothing', async ({ seat }) => {
    const game = await start(seat);
    const [alice] = game.pages;
    await game.land(0, [1, 3]);
    await expectCash(game, [1300, 1500]);
    await game.land(35, [1, 2]);
    await expect(token(alice, 38, 'Alice')).toBeVisible();
    await expectCash(game, [1400, 1500]);
    await game.land(17, [1, 2]);
    await expect(token(alice, 20, 'Alice')).toBeVisible();
    await expectCash(game, [1500, 1500]);
  });

  test('the Free Parking pot is shown and collected', async ({ seat }) => {
    const table = await seat('monopoly', ['Alice', 'Bob'], { houseRules: { freeParkingJackpot: true } });
    const game = await prepare(table);
    const [alice, bob] = game.pages;
    const pot = (page: Page) => space(page, 20).locator('.space-pot');
    await expect(pot(alice)).toHaveText('Pot $0');

    await game.land(0, [1, 3]); // Income Tax goes into the pot, not to the bank
    await expectCash(game, [1300, 1500]);
    for (const page of [alice, bob]) await expect(pot(page)).toHaveText('Pot $200');

    await game.land(18, [1, 1]); // Free Parking takes the whole pot
    await expect(token(alice, 20, 'Alice')).toBeVisible();
    await expectCash(game, [1700, 1500]);
    for (const page of [alice, bob]) await expect(pot(page)).toHaveText('Pot $0');
  });

  test('Go to Jail, a Go to Jail card and a third doubles all jail you, collecting nothing for passing GO', async ({ seat }) => {
    const game = await start(seat);
    const [alice] = game.pages;
    const inJail = alice.locator('.in-jail .token[title="Alice"]');
    await game.land(25, [2, 3]);
    await expect(inJail).toBeVisible();
    await expectCash(game, [1500, 1500]);
    await expect(row(alice, 'Alice').locator('.player-status')).toHaveText('in Jail');

    await game.land(33, [1, 2], { decks: { chance: topped(10), chest: inOrder() } });
    await expect(inJail).toBeVisible();
    await expectCash(game, [1500, 1500]);

    await game.sync({ ...fresh(2), positions: { 1: 36, 2: 0 }, doublesRolled: 2 });
    await game.table.dice(2, 2);
    await button(alice, 'Doubles: roll again').click();
    await expect(inJail).toBeVisible();
    await expectCash(game, [1500, 1500]);
  });

  test('in Jail you may first pay $50 or use a jail card and then roll as usual', async ({ seat }) => {
    const jailed = { positions: { 1: 10, 2: 0 }, jailed: { 1: 0 }, owners: ownedBy(1, PROPERTIES) };
    const game = await start(seat, 2, jailed);
    const [alice] = game.pages;
    await button(alice, 'Pay $50').click();
    await expectCash(game, [1450, 1500]);
    await expect(alice.locator('.in-jail')).toHaveCount(0);
    await game.table.dice(2, 3);
    await button(alice, 'Roll the dice').click();
    await expect(token(alice, 15, 'Alice')).toBeVisible();

    await game.sync({ ...fresh(2), ...jailed, jailCards: { 1: ['chance'], 2: [] }, decks: { chance: topped(0).filter(index => index !== 8), chest: inOrder() } });
    await expect(button(alice, 'Use jail card')).toBeEnabled();
    await button(alice, 'Use jail card').click();
    await expect(button(alice, 'Roll the dice')).toBeVisible();
    await expect(row(alice, 'Alice').locator('.chip-card')).toHaveCount(0);
    await expectCash(game, [1500, 1500]);
  });

  test('doubles get you out of Jail with no extra roll, and a third failed roll pays $50 and moves', async ({ seat }) => {
    const jailed = { positions: { 1: 10, 2: 0 }, jailed: { 1: 0 }, owners: ownedBy(1, PROPERTIES) };
    const game = await start(seat, 2, jailed);
    const [alice] = game.pages;
    await game.table.dice(2, 2);
    await button(alice, 'Roll for doubles').click();
    await expect(token(alice, 14, 'Alice')).toBeVisible();
    await expect(button(alice, 'End turn')).toBeVisible();
    await expect(alice.getByRole('button', { name: /roll/i })).toHaveCount(0);

    await game.sync({ ...fresh(2), ...jailed });
    await game.table.dice(1, 2);
    await button(alice, 'Roll for doubles').click();
    await expect(alice.locator('.in-jail .token[title="Alice"]')).toBeVisible();
    await expect(events(alice)).toContainText('Alice stays in Jail');
    await expect(button(alice, 'End turn')).toBeVisible();

    await game.sync({ ...fresh(2), ...jailed, jailed: { 1: 2 } });
    await game.table.dice(1, 2);
    await button(alice, 'Roll for doubles').click();
    await expect(token(alice, 13, 'Alice')).toBeVisible();
    await expectCash(game, [1450, 1500]);
  });

  test('in Jail you still collect rent, build, trade and bid', async ({ seat }) => {
    const game = await start(seat);
    const [alice, bob] = game.pages;
    // Bob lands on Alice's Baltic Avenue while she sits in Jail
    await game.sync({ positions: { 1: 10, 2: 0 }, jailed: { 1: 0 }, owners: ownedBy(1, [1, 3]), turnHolder: 2, currentPlayer: 2 });
    await game.table.dice(1, 2);
    await button(bob, 'Roll the dice').click();
    await expectCash(game, [1508, 1492]);
    await expect(button(alice, 'Propose a trade')).toBeVisible();

    await game.sync({ auction: { space: 6, highBid: 0, highBidder: null, passed: [] } });
    await button(alice, '$10').click();
    await expect(auction(bob)).toContainText('High bid $10 by Alice');

    await game.sync({ auction: null, turnHolder: 1, currentPlayer: 1, canRoll: true });
    await openDeed(alice, 1);
    await button(alice, 'Build house').click();
    await expect(space(bob, 1).locator('.house')).toHaveCount(1);
  });

  test('any player may trade properties, cash and jail cards with another at any time, and nothing moves until accepted', async ({ seat }) => {
    // Alice has the turn; Bob's brown streets have a house, so only his railroad can be traded
    const game = await start(seat, 3, {
      owners: { ...ownedBy(2, [1, 3, 5]) },
      buildings: { 1: 1 },
      jailCards: { 1: [], 2: [], 3: ['chest'] }
    });
    const [alice, bob, cara] = game.pages;
    await button(cara, 'Propose a trade').click();
    await cara.getByLabel('With').selectOption({ label: 'Bob' });
    const bobGives = cara.getByRole('group', { name: 'Bob gives' });
    await expect(bobGives.getByRole('checkbox')).toHaveCount(1);
    await expect(bobGives.getByLabel('Reading Railroad')).toBeVisible();
    await button(cara, 'Cancel').click();

    await offerTrade(cara, 'Bob', { cash: 100, jailCards: 1 }, { properties: ['Reading Railroad'] });
    await expect(bob.locator('.trade-summary')).toHaveText('Cara gives $100, 1 Get Out of Jail Free card to Bob for Reading Railroad.');
    await expectCash(game, [1500, 1500, 1500], alice);
    await expect(space(alice, 5).locator('.owner-tag')).toHaveText('Bob');

    await button(bob, 'Accept').click();
    await expect(space(alice, 5).locator('.owner-tag')).toHaveText('Cara');
    await expectCash(game, [1500, 1600, 1400], alice);
    await expect(row(alice, 'Bob').locator('.chip-card')).toHaveText('Jail card');
    await expect(row(alice, 'Cara').locator('.chip-card')).toHaveCount(0);
  });

  test('a trade is refused if a receiver could not pay the 10% interest on mortgaged property', async ({ seat }) => {
    const game = await start(seat, 3, { owners: { 5: 2 }, mortgaged: [5], cash: cashOf([1500, 1500, 0]) });
    const [, bob, cara] = game.pages;
    await offerTrade(bob, 'Cara', { properties: ['Reading Railroad (mortgaged)'] });
    await expect(status(bob)).toHaveText('Cara could not pay the 10% interest on the mortgaged property');
    await expect(cara.getByRole('region', { name: 'Trade offer' })).toHaveCount(0);
  });

  test('an offer from or to a player who disconnects is dropped', async ({ seat }) => {
    const game = await start(seat, 3, { owners: { 1: 1 } });
    const [alice, bob, cara] = game.pages;
    await offerTrade(alice, 'Bob', { properties: ['Mediterranean Avenue'] }, { cash: 50 });
    await expect(cara.getByRole('region', { name: 'Trade offer' })).toBeVisible();
    await leave(bob);
    await expect(cara.getByRole('region', { name: 'Trade offer' })).toHaveCount(0);
    await expect(events(cara)).toContainText('The open trade offer was dropped');
    await expect(button(alice, 'Propose a trade')).toBeVisible();
    await expect(space(cara, 1).locator('.owner-tag')).toHaveText('Alice');
  });

  test('whoever receives mortgaged property lifts each mortgage for 110% or keeps it for 10%, and the game waits', async ({ seat }) => {
    const game = await start(seat, 3, { owners: ownedBy(2, [5, 6]), mortgaged: [5, 6] });
    const [alice, bob, cara] = game.pages;
    await offerTrade(bob, 'Cara', { properties: ['Reading Railroad (mortgaged)', 'Oriental Avenue (mortgaged)'] }, { cash: 10 });
    await button(cara, 'Accept').click();
    await expect(turnPanel(cara)).toContainText('Mortgaged property received');
    await expect(turnPanel(alice)).toHaveText('Waiting for Cara to lift or keep the mortgages received');
    await expect(button(alice, 'Roll the dice')).toHaveCount(0);

    await expect(button(cara, 'Pay $15')).toBeVisible(); // $10 and $5 to keep both
    await cara.getByLabel('Lift Reading Railroad now for $110 (keeping it costs $10)').check();
    await button(cara, 'Pay $115').click();
    await expectCash(game, [1500, 1510, 1490 - 115], alice);
    await expect(space(alice, 5).locator('.owner-tag')).toHaveText('Cara');
    await expect(space(alice, 6).locator('.owner-tag')).toHaveText('Mortgaged');
    await expect(button(alice, 'Roll the dice')).toBeVisible();
    // Lifting the kept one later costs the value plus 10% again
    await expect(await openDeed(cara, 6)).toContainText('Mortgage value $50; lifting it costs $55');
  });

  test('an unpaid debt waits for the debtor to raise the cash, and a birthday waits on each player in turn', async ({ seat }) => {
    const game = await start(seat, 3);
    const [alice, bob, cara] = game.pages;
    await game.land(14, [1, 2], {
      owners: { ...ownedBy(2, [37, 39]), 31: 3 },
      cash: cashOf([1500, 5, 5]),
      decks: { chance: inOrder(), chest: topped(8) }
    });
    await expect(turnPanel(bob)).toContainText('You owe Alice $10 (Community Chest) and have $5.');
    await expect(turnPanel(alice)).toHaveText('Waiting for Bob to pay');
    await expect(turnPanel(cara)).toHaveText('Waiting for Bob to pay');
    await openDeed(bob, 39);
    await expect(button(bob, 'Build house')).toHaveAttribute('title', 'Not while money is owed or an auction runs');
    await button(bob, 'Mortgage').click();
    await expectCash(game, [1510, 195, 5], alice);

    await expect(turnPanel(cara)).toContainText('You owe Alice $10 (Community Chest) and have $5.');
    await expect(turnPanel(alice)).toHaveText('Waiting for Cara to pay');
    await openDeed(cara, 31);
    await button(cara, 'Mortgage').click();
    await expectCash(game, [1520, 195, 145], alice);
    await expect(button(alice, 'End turn')).toBeVisible();
  });

  test('bankrupt to a player: buildings sell at half price and they take the cash, properties and jail cards', async ({ seat }) => {
    const game = await start(seat, 3);
    const [alice, bob] = game.pages;
    // Bob's Boardwalk hotel charges $2000
    await game.land(35, [1, 3], {
      cash: cashOf([10, 1500, 1500]),
      owners: { ...ownedBy(1, [1, 3, 5]), ...ownedBy(2, [37, 39]) },
      buildings: { 1: 1, 3: 1, 37: 5, 39: 5 },
      mortgaged: [5],
      jailCards: { 1: ['chest'], 2: [], 3: [] }
    });
    await expect(turnPanel(alice)).toContainText('You owe Bob $2000 (rent for Boardwalk)');
    await button(alice, 'Declare bankruptcy').click();
    await expect(turnPanel(alice)).toContainText('Give everything to Bob?');
    await button(alice, 'Confirm bankruptcy').click();

    await expect(turnPanel(bob)).toContainText('Mortgaged property received');
    await button(bob, 'Pay $10').click();
    await expectCash(game, [0, 1500 + 10 + 50 - 10, 1500], bob);
    for (const index of [1, 3, 5]) await expect(space(bob, index).locator('.owner-tag')).toHaveText(index === 5 ? 'Mortgaged' : 'Bob');
    await expect(space(bob, 1).locator('.house')).toHaveCount(0);
    await expect(row(bob, 'Bob').locator('.chip-card')).toHaveText('Jail card');
    await expect(row(bob, 'Alice').locator('.player-status')).toHaveText('bankrupt');
    await expect(bob.locator('.turn-message')).toHaveText('Your turn');
  });

  test('bankrupt to the bank: buildings and jail cards go back and each property is auctioned unmortgaged', async ({ seat }) => {
    const game = await start(seat, 3);
    const [alice, bob, cara] = game.pages;
    await game.land(0, [1, 3], {
      cash: cashOf([100, 1500, 1500]),
      owners: ownedBy(1, [1, 6, 8, 9]),
      buildings: { 6: 1, 8: 1, 9: 1 },
      mortgaged: [1],
      jailCards: { 1: ['chance'], 2: [], 3: [] },
      decks: { chance: inOrder().filter(index => index !== 8), chest: inOrder() }
    });
    await expect(turnPanel(alice)).toContainText('You owe the bank $200 (Income Tax)');
    await button(alice, 'Declare bankruptcy').click();
    await expect(turnPanel(alice)).toContainText('Give everything to the bank?');
    await button(alice, 'Confirm bankruptcy').click();

    await expect(auction(bob)).toContainText('Auction: Mediterranean Avenue');
    await expect(auction(bob)).toContainText('Still bidding: Bob, Cara');
    await expect(auction(alice).getByRole('button')).toHaveCount(0);
    await expect(bob.getByText('Cards left: Chance 16, Community Chest 16')).toBeVisible();
    await expect(space(bob, 6).locator('.house')).toHaveCount(0);
    await button(bob, '$1').click();
    await button(cara, 'Pass').click();
    await expect(space(cara, 1).locator('.owner-tag')).toHaveText('Bob');
    await expect(auction(cara)).toContainText('Auction: Oriental Avenue');
  });

  test('on your turn you may declare bankruptcy without a debt, to the bank, to leave the game', async ({ seat }) => {
    const game = await start(seat, 3, { owners: { 1: 1 } });
    const [alice, bob] = game.pages;
    await button(alice, 'Declare bankruptcy').click();
    await expect(turnPanel(alice)).toContainText('Leave the game and give your properties to the bank for auction?');
    await button(alice, 'Confirm bankruptcy').click();
    await expect(row(bob, 'Alice').locator('.player-status')).toHaveText('bankrupt');
    await expect(auction(bob)).toContainText('Auction: Mediterranean Avenue');
    await expect(bob.locator('.turn-message')).toHaveText('Your turn');
  });

  test('the last player who is not bankrupt wins', async ({ seat }) => {
    const game = await start(seat);
    const [alice, bob] = game.pages;
    await declareBankruptcy(alice);
    await expect(bob.locator('.turn-message')).toHaveText('Game over: Bob wins');
    await expect(status(bob)).toContainText('Bob wins: everyone else is bankrupt');
    await expect(row(alice, 'Bob').locator('.player-status')).toHaveText('winner');
  });

  test('nothing is hidden but the order of the two decks', async ({ seat }) => {
    const game = await start(seat, 2, {
      cash: cashOf([1234, 1500]),
      owners: { 1: 1, 5: 1 },
      mortgaged: [5],
      jailCards: { 1: ['chest'], 2: [] },
      decks: { chance: inOrder(), chest: inOrder().filter(index => index !== 4) }
    });
    const [, bob] = game.pages;
    await expect(cash(bob, 'Alice')).toHaveText('$1234');
    await expect(row(bob, 'Alice').getByRole('button', { name: 'Mediterranean Avenue' })).toBeVisible();
    await expect(row(bob, 'Alice').getByRole('button', { name: 'Reading Railroad (mortgaged)' })).toBeVisible();
    await expect(row(bob, 'Alice').locator('.chip-card')).toHaveText('Jail card');
    // Only how many cards are left shows, never which card is next
    await expect(bob.getByText('Cards left: Chance 16, Community Chest 15')).toBeVisible();
    await expect(bob.locator('.drawn-card')).toHaveCount(0);
    for (const card of [...DECKS.chance, ...DECKS.chest]) await expect(bob.getByText(card.text)).toHaveCount(0);
  });

  test('a dismissed player who owes another player goes bankrupt to them', async ({ seat }) => {
    const game = await start(seat, 3, {
      owners: { 39: 3 },
      cash: cashOf([1500, 1500, 20]),
      debts: [{ debtor: 3, creditor: 1, amount: 500, reason: 'rent for Boardwalk' }],
      currentPlayer: 3
    });
    const [alice, bob, cara] = game.pages;
    await leave(cara);
    await dismiss('Cara', alice, bob);
    await expect(space(alice, 39).locator('.owner-tag')).toHaveText('Alice');
    await expect(cash(alice, 'Alice')).toHaveText('$1520');
    await expect(auction(alice)).toHaveCount(0);
    await expect(button(alice, 'Roll the dice')).toBeVisible();
  });

  test('a dismissed player owing nobody goes to the bank: their trade and debts are dropped and the next turn begins', async ({ seat }) => {
    // Bob has the turn, but Cara owes him $10; Bob has an offer open to Alice
    const game = await start(seat, 3, {
      owners: { 1: 2 },
      cash: cashOf([1500, 1500, 5]),
      turnHolder: 2,
      currentPlayer: 3,
      canRoll: true,
      debts: [{ debtor: 3, creditor: 2, amount: 10, reason: 'Community Chest' }],
      trade: { from: 2, to: 1, give: { properties: [1], cash: 0, jailCards: 0 }, get: { properties: [], cash: 50, jailCards: 0 } }
    });
    const [alice, bob, cara] = game.pages;
    await expect(alice.getByRole('region', { name: 'Trade offer' })).toBeVisible();
    await leave(bob);
    await expect(alice.getByRole('region', { name: 'Trade offer' })).toHaveCount(0);
    await dismiss('Bob', alice, cara);
    await expect(auction(cara)).toContainText('Auction: Mediterranean Avenue');
    await expect(auction(cara)).toContainText('Still bidding: Alice, Cara');
    await expect(cara.locator('.turn-message')).toHaveText('Your turn');
    await expect(turnPanel(cara)).not.toContainText('You owe');
    await expect(cash(alice, 'Cara')).toHaveText('$5');
  });

  test('the last player left after a dismissal wins', async ({ seat }) => {
    const game = await start(seat);
    const [alice, bob] = game.pages;
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });

  test('an undo needs every player\'s approval and goes back past bids and trades', async ({ seat }) => {
    const game = await start(seat, 3);
    const [alice, bob, cara] = game.pages;
    await game.table.dice(1, 2);
    await button(alice, 'Roll the dice').click();
    await expect(token(alice, 3, 'Alice')).toBeVisible();
    await offerTrade(bob, 'Cara', { cash: 10 });
    await expect(cara.locator('.trade-summary')).toBeVisible();

    await button(alice, 'Undo').click();
    await button(bob, 'Approve').click();
    await cara.locator('.undo-vote').getByRole('button', { name: 'Decline' }).click();
    await expect(cara.locator('.undo-vote')).toHaveCount(0);
    await expect(token(alice, 3, 'Alice')).toBeVisible();

    await undo(alice, bob, cara);
    await expect(token(alice, 0, 'Alice')).toBeVisible();
    await expect(button(alice, 'Roll the dice')).toBeVisible();
    await expect(cara.locator('.trade-summary')).toHaveCount(0);
    // The decks are shuffled again, so the roll played again may draw differently
    const decks = (await game.table.state<GameState>()).decks;
    expect(decks.chance.join() !== inOrder().join() || decks.chest.join() !== inOrder().join()).toBe(true);
  });
});

test.describe('Monopoly controls', () => {
  test('the side panel shows Roll the dice, roll again, Buy or Decline, the Jail choices, End turn and any debt', async ({ seat }) => {
    const game = await start(seat);
    const [alice, bob] = game.pages;
    await expect(button(alice, 'Roll the dice')).toBeVisible();
    await expect(turnPanel(bob)).toHaveText('Waiting for Alice');
    await game.table.dice(3, 3);
    await button(alice, 'Roll the dice').click();
    await expect(button(alice, 'Buy Oriental Avenue for $100')).toBeVisible();
    await expect(button(alice, 'Decline and auction')).toBeVisible();
    await button(alice, 'Buy Oriental Avenue for $100').click();
    await game.table.dice(1, 3);
    await button(alice, 'Doubles: roll again').click();
    await expect(token(alice, 10, 'Alice')).toBeVisible(); // just visiting
    await expect(button(alice, 'End turn')).toBeVisible();

    await game.sync({ ...fresh(2), positions: { 1: 10, 2: 0 }, jailed: { 1: 0 } });
    for (const name of ['Roll for doubles', 'Pay $50', 'Use jail card']) await expect(button(alice, name)).toBeVisible();
    await expect(button(alice, 'Use jail card')).toBeDisabled();

    await game.land(0, [1, 3], { cash: cashOf([100, 1500]) });
    await expect(turnPanel(alice)).toContainText('You owe the bank $200 (Income Tax) and have $100.');
  });

  test('clicking a property or its chip opens its Title Deed, whose greyed out buttons explain why', async ({ seat }) => {
    const game = await start(seat, 2, { owners: { ...ownedBy(1, [1, 3]), 37: 1 } });
    const [alice, bob] = game.pages;
    const mediterranean = await openDeed(alice, 1);
    await expect(mediterranean).toContainText('Owned by Alice');
    await expect(button(alice, 'Build house')).toBeEnabled();
    await expect(button(alice, 'Sell building')).toBeDisabled();
    await expect(button(alice, 'Sell building')).toHaveAttribute('title', 'You have no buildings there');
    await button(alice, 'Mortgage').click();
    await expect(button(alice, 'Lift mortgage')).toBeEnabled();
    await expect(button(alice, 'Build house')).toHaveAttribute('title', 'Lift every mortgage in the group before building');
    await mediterranean.getByRole('button', { name: 'Close the title deed' }).click();
    await expect(mediterranean).toHaveCount(0);

    // The chip in the player list opens it too; another player sees the deed without the buttons
    await row(bob, 'Alice').getByRole('button', { name: 'Park Place' }).click();
    await expect(deed(bob, 37)).toContainText('Owned by Alice');
    await expect(deed(bob, 37).getByRole('button')).toHaveCount(1); // just Close

    // While owing, only selling and mortgaging work
    await game.sync({ mortgaged: [37], buildings: { 1: 1, 3: 1 }, debts: [{ debtor: 1, creditor: null, amount: 500, reason: 'Income Tax' }] });
    await openDeed(alice, 1);
    await expect(button(alice, 'Build house')).toHaveAttribute('title', 'Not while money is owed or an auction runs');
    await expect(button(alice, 'Sell building')).toBeEnabled();
    await openDeed(alice, 37);
    await expect(button(alice, 'Lift mortgage')).toHaveAttribute('title', 'Not while money is owed or an auction runs');
  });

  test('during an auction every player still in the game sees quick bids, a box for any amount, Bid and Pass', async ({ seat }) => {
    const game = await start(seat, 3, { bankrupt: [3], auction: { space: 3, highBid: 0, highBidder: null, passed: [] } });
    const [alice, bob, cara] = game.pages;
    for (const page of [alice, bob]) {
      for (const name of ['$1', '$10', '$50', 'Bid', 'Pass']) await expect(button(page, name)).toBeVisible();
      await expect(auction(page).getByRole('spinbutton')).toBeVisible();
    }
    await expect(auction(cara)).toContainText('Still bidding: Alice, Bob');
    await expect(auction(cara).getByRole('button')).toHaveCount(0);

    await button(bob, '$50').click();
    for (const name of ['$51', '$60', '$100']) await expect(button(alice, name)).toBeVisible();
    await auction(alice).getByRole('spinbutton').fill('75');
    await button(alice, 'Bid').click();
    await expect(auction(bob)).toContainText('High bid $75 by Alice');
    await expect(auction(alice)).toContainText('You hold the high bid');
  });

  test('Propose a trade, choose a player, tick what each side gives, Send offer, then Accept, Decline or Withdraw', async ({ seat }) => {
    const game = await start(seat, 3, { owners: { 1: 1, 5: 3 }, jailCards: { 1: ['chance'], 2: [], 3: [] } });
    const [alice, bob, cara] = game.pages;
    const offer = async () => offerTrade(alice, 'Cara', { properties: ['Mediterranean Avenue'], cash: 100, jailCards: 1 }, { properties: ['Reading Railroad'] });
    await offer();
    const summary = 'Alice gives Mediterranean Avenue, $100, 1 Get Out of Jail Free card to Cara for Reading Railroad.';
    await expect(cara.locator('.trade-summary')).toHaveText(summary);
    await expect(button(cara, 'Accept')).toBeVisible();
    await expect(button(cara, 'Decline')).toBeVisible();
    await expect(bob.locator('.trade-summary')).toHaveText(summary);
    await expect(button(bob, 'Accept')).toHaveCount(0);
    await button(alice, 'Withdraw offer').click();
    await expect(cara.locator('.trade-summary')).toHaveCount(0);

    await offer();
    await button(cara, 'Decline').click();
    await expect(cara.locator('.trade-summary')).toHaveCount(0);
    await expect(space(bob, 1).locator('.owner-tag')).toHaveText('Alice');

    await offer();
    await button(cara, 'Accept').click();
    await expect(space(bob, 1).locator('.owner-tag')).toHaveText('Cara');
    await expect(space(bob, 5).locator('.owner-tag')).toHaveText('Alice');
    await expect(row(bob, 'Cara').locator('.chip-card')).toHaveText('Jail card');
  });

  test('Declare bankruptcy asks you to confirm first', async ({ seat }) => {
    const game = await start(seat);
    const [alice] = game.pages;
    await button(alice, 'Declare bankruptcy').click();
    await expect(button(alice, 'Confirm bankruptcy')).toBeVisible();
    await button(alice, 'Keep playing').click();
    await expect(button(alice, 'Confirm bankruptcy')).toHaveCount(0);
    await expect(button(alice, 'Declare bankruptcy')).toBeVisible();
    await expect(row(alice, 'Alice').locator('.player-status')).toHaveCount(0);
  });

  test('the board shows owners, prices, buildings, mortgages, tokens and Jail, the last roll and card; the side lists players and events', async ({ seat }) => {
    const game = await start(seat, 3, {
      owners: { ...ownedBy(1, [1, 3]), 39: 2 },
      buildings: { 1: 2, 3: 5 },
      mortgaged: [39],
      positions: { 1: 10, 2: 5, 3: 10 },
      jailed: { 1: 0 },
      jailCards: { 1: [], 2: ['chest'], 3: [] },
      dice: [1, 2],
      drawnCard: { deck: 'chance', index: 7, seat: 1 },
      log: ['Older event', 'Newest event']
    });
    const [alice, bob] = game.pages;
    await expect(space(bob, 1).locator('.owner-tag')).toHaveText('Alice');
    await expect(space(bob, 6).locator('.space-price')).toHaveText('$100');
    await expect(space(bob, 1).locator('.house')).toHaveCount(2);
    await expect(space(bob, 1).locator('.house').first()).toHaveCSS('background-color', 'rgb(47, 191, 90)');
    await expect(space(bob, 3).locator('.hotel')).toHaveCSS('background-color', 'rgb(211, 47, 47)');
    await expect(space(bob, 39).locator('.owner-tag')).toHaveText('Mortgaged');
    await expect(space(bob, 39)).toHaveClass(/space-mortgaged/);
    await expect(token(bob, 5, 'Bob')).toBeVisible();
    await expect(bob.locator('.in-jail .token[title="Alice"]')).toBeVisible();
    await expect(bob.locator('.in-jail')).toHaveCSS('border-style', 'dashed');
    await expect(token(bob, 10, 'Cara')).toBeVisible();
    await expect(bob.locator('.in-jail .token[title="Cara"]')).toHaveCount(0); // just visiting
    await expect(bob.getByRole('img', { name: 'Last roll: 1 and 2' })).toBeVisible();
    await expect(bob.locator('.drawn-card')).toContainText('Chance (Alice)');
    await expect(bob.locator('.drawn-card-text')).toHaveText('Bank pays you dividend of $50');

    await expect(cash(alice, 'Bob')).toHaveText('$1500');
    await expect(row(alice, 'Alice').getByRole('button')).toHaveCount(2);
    await expect(row(alice, 'Bob').getByRole('button', { name: 'Boardwalk (mortgaged)' })).toBeVisible();
    await expect(row(alice, 'Bob').locator('.chip-card')).toHaveText('Jail card');
    await expect(events(alice).locator('li')).toHaveText(['Newest event', 'Older event']);
  });

  test('clicking Undo asks everyone to undo the last move', async ({ seat }) => {
    const game = await start(seat, 3, { owners: ownedBy(1, PROPERTIES) });
    const [alice, bob, cara] = game.pages;
    await expect(button(alice, 'Undo')).toBeDisabled();
    await game.table.dice(1, 2);
    await button(alice, 'Roll the dice').click();
    await button(alice, 'Undo').click();
    await expect(button(bob, 'Approve')).toBeVisible();
    await expect(button(cara, 'Approve')).toBeVisible();
    await expect(button(alice, 'Approve')).toHaveCount(0);
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const game = await start(seat);
    const faq = await openFaq(game.pages[0]);
    await expect(faq).toContainText('Free Parking is just a resting place');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Monopoly differences from Wikipedia', () => {
  test('rent is collected for the owner on landing, without them asking', async ({ seat }) => {
    const game = await start(seat);
    const [alice] = game.pages;
    await game.land(0, [1, 2], { owners: { 3: 2 } });
    await expect(events(alice)).toContainText('Alice paid Bob $4 (rent for Baltic Avenue)');
    await expectCash(game, [1496, 1504]);
  });

  test('auction bids are capped by cash, a pass is final, and a disconnected player counts as passed', async ({ seat }) => {
    const game = await start(seat, 3, { cash: cashOf([30, 1500, 1500]), auction: { space: 3, highBid: 0, highBidder: null, passed: [] } });
    const [alice, bob, cara] = game.pages;
    await expect(button(alice, '$50')).toBeDisabled();
    await auction(alice).getByRole('spinbutton').fill('31');
    await expect(button(alice, 'Bid')).toBeDisabled();
    await button(bob, '$10').click();
    await button(alice, 'Pass').click();
    await expect(auction(alice)).toContainText('You passed');
    await expect(button(alice, '$11')).toHaveCount(0);
    // Cara has neither bid nor passed, so leaving ends the auction
    await leave(cara);
    await expect(space(alice, 3).locator('.owner-tag')).toHaveText('Bob');
    await expect(cash(alice, 'Bob')).toHaveText('$1490');
  });

  test('while an auction runs the player to act may sell buildings or mortgage but not build, and anyone may trade', async ({ seat }) => {
    const game = await start(seat, 2, {
      owners: { ...ownedBy(1, [1, 3]), 37: 1 },
      buildings: { 1: 1, 3: 1 },
      auction: { space: 6, highBid: 0, highBidder: null, passed: [] }
    });
    const [alice, bob] = game.pages;
    await expect(turnPanel(alice)).toContainText('Your turn goes on once the auction is over.');
    await openDeed(alice, 1);
    await expect(button(alice, 'Build house')).toHaveAttribute('title', 'Not while money is owed or an auction runs');
    await button(alice, 'Sell building').click();
    await expect(space(bob, 1).locator('.house')).toHaveCount(0);
    await openDeed(alice, 37);
    await button(alice, 'Mortgage').click();
    await expect(space(bob, 37).locator('.owner-tag')).toHaveText('Mortgaged');
    await expect(button(bob, 'Propose a trade')).toBeVisible();
    await expect(button(alice, 'Propose a trade')).toBeVisible();
  });

  test('while an auction runs the player to act may declare bankruptcy', async ({ seat }) => {
    const game = await start(seat, 3, { auction: { space: 6, highBid: 0, highBidder: null, passed: [] } });
    const [alice, bob] = game.pages;
    await expect(button(alice, 'Declare bankruptcy')).toBeVisible();
    await expect(button(bob, 'Declare bankruptcy')).toHaveCount(0);
  });

  test('there are no house auctions: the last houses go to whoever builds first', async ({ seat }) => {
    // 31 houses stand on Bob's streets; his orange group could take more
    const game = await start(seat, 2, {
      owners: { ...ownedBy(1, [1, 3]), ...ownedBy(2, [6, 8, 9, 11, 13, 14, 16, 18, 19]) },
      buildings: { 6: 4, 8: 4, 9: 4, 11: 4, 13: 4, 14: 4, 16: 3, 18: 2, 19: 2 }
    });
    const [alice, bob] = game.pages;
    await openDeed(alice, 1);
    await button(alice, 'Build house').click();
    await expect(space(bob, 1).locator('.house')).toHaveCount(1);
    await game.sync({ turnHolder: 2, currentPlayer: 2 });
    await openDeed(bob, 18);
    await expect(button(bob, 'Build house')).toHaveAttribute('title', 'The bank has no houses left');
  });

  test('building and mortgaging happen on your own turn, or selling and mortgaging while you owe money', async ({ seat }) => {
    const game = await start(seat, 3, { owners: { ...ownedBy(2, [1, 3]), 31: 3 }, buildings: { 1: 1, 3: 1 } });
    const [alice, bob, cara] = game.pages;
    await openDeed(bob, 1);
    await expect(deed(bob, 1).getByRole('button')).toHaveCount(1); // just Close
    await game.sync({ currentPlayer: 3, debts: [{ debtor: 3, creditor: null, amount: 500, reason: 'Income Tax' }] });
    await openDeed(cara, 31);
    await expect(button(cara, 'Mortgage')).toBeEnabled();
    await expect(button(cara, 'Build house')).toBeDisabled();
    await button(cara, 'Mortgage').click();
    await expect(space(alice, 31).locator('.owner-tag')).toHaveText('Mortgaged');
  });

  test('a hotel sells outright for half of five times the house cost when the bank has fewer than four houses', async ({ seat }) => {
    const elsewhere = { 6: 4, 8: 4, 9: 4, 11: 4, 13: 4, 14: 4, 16: 4, 18: 3 };
    const game = await start(seat, 2, { owners: ownedBy(1, [37, 39]), buildings: { ...elsewhere, 37: 5, 39: 5 } });
    const [alice] = game.pages;
    await openDeed(alice, 39);
    await button(alice, 'Sell building').click();
    await expect(space(alice, 39).locator('.hotel, .house')).toHaveCount(0);
    await expectCash(game, [1500 + 500, 1500]);
  });

  test('one trade offer waits for its answer before another can be made', async ({ seat }) => {
    const game = await start(seat, 3);
    const [alice, bob, cara] = game.pages;
    await offerTrade(alice, 'Bob', { cash: 10 });
    for (const page of [alice, bob, cara]) {
      await expect(page.locator('.trade-summary')).toHaveText('Alice gives $10 to Bob for nothing.');
      await expect(button(page, 'Propose a trade')).toHaveCount(0);
    }
    await button(bob, 'Decline').click();
    await expect(button(cara, 'Propose a trade')).toBeVisible();
  });

  test('debts are paid in order, and bankruptcy to the first creditor drops the other debts', async ({ seat }) => {
    const game = await start(seat, 4);
    const [alice, bob, cara] = game.pages;
    // Chairman of the Board: Alice pays $50 to each of three players with $60
    await game.land(4, [1, 2], { cash: cashOf([60, 1500, 1500, 1500]), decks: { chance: topped(14), chest: inOrder() } });
    await expectCash(game, [10, 1550, 1500, 1500], bob);
    await expect(turnPanel(alice)).toContainText('You owe Cara $50');
    await declareBankruptcy(alice);
    await expectCash(game, [0, 1550, 1510, 1500], bob);
    await expect(turnPanel(cara)).not.toContainText('You owe');
    await expect(bob.locator('.turn-message')).toHaveText('Your turn');
  });

  test('declaring bankruptcy without a debt resigns to the bank, and only on your own turn', async ({ seat }) => {
    const game = await start(seat, 3, { owners: { 1: 1 } });
    const [alice, bob] = game.pages;
    await expect(button(bob, 'Declare bankruptcy')).toHaveCount(0);
    await declareBankruptcy(alice);
    await expect(auction(bob)).toContainText('Auction: Mediterranean Avenue');
    await expect(cash(bob, 'Alice')).toHaveText('$0');
  });

  test('the third failed roll in Jail pays the $50 fine even with a Get Out of Jail Free card', async ({ seat }) => {
    const game = await start(seat, 2, {
      positions: { 1: 10, 2: 0 },
      jailed: { 1: 2 },
      jailCards: { 1: ['chance'], 2: [] },
      owners: ownedBy(1, PROPERTIES),
      decks: { chance: inOrder().filter(index => index !== 8), chest: inOrder() }
    });
    const [alice] = game.pages;
    await game.table.dice(1, 2);
    await button(alice, 'Roll for doubles').click();
    await expect(token(alice, 13, 'Alice')).toBeVisible();
    await expectCash(game, [1450, 1500]);
    await expect(row(alice, 'Alice').locator('.chip-card')).toHaveText('Jail card');
  });

  test('a dismissed player is out as if bankrupt, and an offer with a player who disconnects is dropped', async ({ seat }) => {
    const game = await start(seat, 3, {
      owners: { 1: 3 },
      cash: cashOf([1500, 1500, 5]),
      currentPlayer: 3,
      debts: [{ debtor: 3, creditor: 2, amount: 10, reason: 'Community Chest' }],
      trade: { from: 3, to: 1, give: { properties: [1], cash: 0, jailCards: 0 }, get: { properties: [], cash: 50, jailCards: 0 } }
    });
    const [alice, bob, cara] = game.pages;
    await leave(cara);
    await expect(alice.locator('.trade-summary')).toHaveCount(0);
    await dismiss('Cara', alice, bob);
    await expect(space(alice, 1).locator('.owner-tag')).toHaveText('Bob');
    await expect(cash(alice, 'Bob')).toHaveText('$1505');
    await expect(row(alice, 'Cara').locator('.player-status')).toHaveText('bankrupt');
  });
});
