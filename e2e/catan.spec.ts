import type { Page } from '@playwright/test';
import { agreeToHouseRules, dismiss, expect, joinGame, leave, newPlayer, openFaq, test, undo, type Seat, type Table } from './fixtures.ts';
import {
  EDGES, HEX_NEIGHBORS, HEX_VERTICES, NUMBER_TOKENS, RESOURCES, VERTEX_EDGES, VERTEX_HEXES, VERTEX_NEIGHBORS, pips, randomLayout
} from '../games/catan/board.ts';
import { DEV_DECK } from '../games/catan/devCards.ts';
import { LAYOUT } from '../games/catan/testing.ts';
import type { Building, GameState, Resources } from '../games/catan/types.ts';

// One test per rule, control and difference in games/catan/README.md. Players join as Alice (seat 1), Bob (seat 2),
// Cara (seat 3) and, for four, Dan (seat 4). Most tests craft a state past setup on the unit tests' fixed board
// (games/catan/testing.ts): hexes 0-3 forest, 4-7 pasture, 8-11 fields, 12-14 hills, 15-17 mountains and the desert
// at 18, with tokens 2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12 in hex order. Hex 0 is the top left.

const NAMES = ['Alice', 'Bob', 'Cara'];
const FOUR = ['Alice', 'Bob', 'Cara', 'Dan'];

type Hand = Partial<Resources>;
type Crafted = Partial<Omit<GameState, 'hands' | 'bank'>> & { hands?: Record<number, Hand>; bank?: Partial<Resources> };

const SETTLEMENT: Hand = { wood: 1, brick: 1, sheep: 1, wheat: 1 };
const ROAD: Hand = { wood: 1, brick: 1 };
const DEV_CARD: Hand = { sheep: 1, wheat: 1, ore: 1 };

// Board geometry, as the unit tests name it
const corner = (hex: number, k: number) => HEX_VERTICES[hex][k];
function edgeBetween(a: number, b: number): number {
  const edge = EDGES.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
  if (edge < 0) throw new Error(`No edge between ${a} and ${b}`);
  return edge;
}
// The edges round a hex from corner `from` for `count` steps
const ring = (hex: number, from: number, count: number) =>
  Array.from({ length: count }, (_, step) => edgeBetween(corner(hex, (from + step) % 6), corner(hex, (from + step + 1) % 6)));
// The edge at corner k of an inland hex that leaves the hex
function outward(hex: number, k: number): number {
  const edge = VERTEX_EDGES[corner(hex, k)].find(other => !EDGES[other].every(vertex => HEX_VERTICES[hex].includes(vertex)));
  if (edge === undefined) throw new Error(`Corner ${k} of hex ${hex} is on the coast`);
  return edge;
}
const roadsOf = (seat: number, edges: number[]) => Object.fromEntries(edges.map(edge => [edge, seat]));
const settlement = (seat: number): Building => ({ seat, city: false });
const city = (seat: number): Building => ({ seat, city: true });

const full = (hand: Hand): Resources => ({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0, ...hand });

// A state past setup: Alice to roll, nothing built, the robber on the desert, the deck in printed order, and each
// hand's cards taken from the bank
function craftedState(players: number, { hands = {}, bank = {}, ...fields }: Crafted): Partial<GameState> {
  const seats = Array.from({ length: players }, (_, index) => index + 1);
  const each = <T>(value: (seat: number) => T) => Object.fromEntries(seats.map(seat => [seat, value(seat)]));
  const held = each(seat => full(hands[seat] ?? {}));
  const left = full(Object.fromEntries(RESOURCES.map(resource => [resource, 19 - seats.reduce((sum, seat) => sum + held[seat][resource], 0)])));
  return {
    started: true, setup: null, layout: LAYOUT, robber: 18, roads: {}, buildings: {}, hands: held, bank: { ...left, ...bank },
    devDeck: [...DEV_DECK], devCards: each(() => []), boughtThisTurn: [], devPlayed: false, knights: each(() => 0),
    longestRoad: null, largestArmy: null, turnHolder: 1, currentPlayer: fields.turnHolder ?? 1, rolled: false, dice: null,
    pending: null, trade: null, steal: null, log: [], lastMove: null, isGameOver: false, winners: [],
    ...fields
  };
}

let patches = 0;

// Patches the state and waits until every open page shows it
async function settle(table: Table, fields: object): Promise<void> {
  const marker = `Crafted state ${++patches}`;
  await table.patch({ ...fields, gameStatus: marker });
  for (const page of table.pages) if (!page.isClosed()) await expect(status(page)).toHaveText(marker);
}

const craft = (table: Table, fields: Crafted = {}) => settle(table, craftedState(table.pages.length, fields));

async function start(seat: Seat, fields: Crafted = {}, names = NAMES) {
  const table = await seat('catan', names);
  await craft(table, fields);
  return { table, pages: table.pages };
}

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const vertex = (page: Page, id: number) => button(page, `Intersection ${id}`);
const path = (page: Page, id: number) => button(page, `Road at path ${id}`);
// A path's box has no width or height when it runs straight up or across, so Playwright never sees it as visible;
// the click still lands on the path's wide hit line
const clickPath = (page: Page, id: number) => path(page, id).click({ force: true });
const hex = (page: Page, id: number) => page.locator('.hex').nth(id);
const status = (page: Page) => page.locator('.game-status');
const tradePartner = (page: Page) => page.locator('.trade-partner select');
const turnMessage = (page: Page) => page.locator('.turn-message');
const row = (page: Page, name: string) => page.locator('.player-row').filter({ has: page.locator('.player-name', { hasText: name }) });
const bankCount = (page: Page, label: string) => page.getByLabel('Bank').getByText(new RegExp(`^${label} \\d+$`));
const piece = (page: Page, title: string) => page.locator('.building').filter({ hasText: title });
const devCardRow = (page: Page, name: string) => page.locator('.dev-card').filter({ has: page.locator('.dev-card-name', { hasText: name }) });
const SETTLEMENT_PROMPT = 'Place a settlement: click a highlighted intersection.';

async function expectHand(page: Page, hand: Hand): Promise<void> {
  for (const resource of RESOURCES) {
    await expect(page.locator(`.hand-panel .res-${resource} .resource-count`)).toHaveText(String(hand[resource] ?? 0));
  }
}

async function roll(table: Table, page: Page, first: number, second: number): Promise<void> {
  await table.dice(first, second);
  await button(page, 'Roll the dice').click();
}

async function counter(page: Page, label: string, times: number): Promise<void> {
  for (let index = 0; index < times; index++) await page.getByRole('button', { name: label, exact: true }).click();
}

// Waits until the server has seen `name` drop
async function dropped(page: Page, name: string): Promise<void> {
  await expect(page.locator('.presence-player', { hasText: name })).toBeVisible();
}

// The numbers the server's random must return for the next lobby reset to deal a board, a deck in printed order and
// then the roll-off dice `faces`. The board's draws are recorded from a fixed generator, as the layout may redraw.
function lobbyValues(faces: number[]): number[] {
  let seed = 12345;
  const recorded: number[] = [];
  randomLayout(() => {
    seed = (seed * 16807) % 2147483647;
    const value = (seed - 1) / 2147483646;
    recorded.push(value);
    return value;
  });
  return [...recorded, ...Array<number>(DEV_DECK.length - 1).fill(0.999), ...faces.map(face => (face - 0.5) / 6)];
}

// The hexes' labels in hex order, e.g. 'Forest (Wood) 5' or 'Desert'
const hexLabels = (page: Page) => page.locator('.hex > title').allTextContents();
const tokenOf = (label: string) => Number(label.split(' ').at(-1));

// The board's 6s and 8s share no side
function redsApart(labels: string[]): boolean {
  const red = (index: number) => [6, 8].includes(tokenOf(labels[index]));
  return labels.every((_, index) => !red(index) || HEX_NEIGHBORS[index].every(other => !red(other)));
}

// When the bank is short of a resource two players are owed nobody takes it; a single player owed takes what is left
async function checkBankShortage(seat: Seat): Promise<void> {
  // Hex 0 is forest with a 2; Alice's settlement and Bob's city are on it, and the bank has 2 wood for the 3 owed
  const { table, pages: [alice, bob] } = await start(seat, {
    buildings: { [corner(0, 0)]: settlement(1), [corner(0, 3)]: city(2) }, bank: { wood: 2 }
  });
  await roll(table, alice, 1, 1);
  await expect(status(alice)).toContainText('The bank is short of wood, so nobody takes any');
  await expectHand(alice, {});
  await expectHand(bob, {});
  await expect(bankCount(alice, 'Wood')).toHaveText('Wood 2');

  // Only Bob is owed wood: he takes the 1 left
  await craft(table, { buildings: { [corner(0, 3)]: city(2) }, bank: { wood: 1 } });
  await roll(table, alice, 1, 1);
  await expectHand(bob, { wood: 1 });
  await expect(bankCount(alice, 'Wood')).toHaveText('Wood 0');
}

test.describe('Catan rules', () => {
  test('the board has 19 shuffled hexes, 18 number tokens and 9 ports, no 6 or 8 neighbours, and the robber on the desert', async ({ seat }) => {
    const boards: string[] = [];
    for (let game = 0; game < 2; game++) {
      const page = (await seat('catan', NAMES)).pages[0];
      await expect(page.locator('.hex')).toHaveCount(19);
      for (const [terrain, count] of [['wood', 4], ['sheep', 4], ['wheat', 4], ['brick', 3], ['ore', 3], ['desert', 1]] as const) {
        await expect(page.locator(`.hex.terrain-${terrain}`)).toHaveCount(count);
      }
      const tokens = (await page.locator('.token-number').allTextContents()).map(Number).sort((a, b) => a - b);
      expect(tokens).toEqual(NUMBER_TOKENS);
      await expect(page.locator('.port')).toHaveCount(9);
      await expect(page.locator('.port-any')).toHaveCount(4);
      for (const resource of RESOURCES) await expect(page.locator(`.port-${resource}`)).toHaveCount(1);

      const labels = await hexLabels(page);
      expect(redsApart(labels)).toBe(true);
      const desert = await hex(page, labels.indexOf('Desert')).boundingBox();
      const robber = await page.locator('.robber').boundingBox();
      if (!desert || !robber) throw new Error('The desert or robber is not drawn');
      const middle = { x: robber.x + robber.width / 2, y: robber.y + robber.height / 2 };
      expect(middle.x).toBeGreaterThan(desert.x);
      expect(middle.x).toBeLessThan(desert.x + desert.width);
      expect(middle.y).toBeGreaterThan(desert.y);
      expect(middle.y).toBeLessThan(desert.y + desert.height);
      const ports = await page.locator('.port').evaluateAll(elements => elements.map(element => element.getAttribute('class')).join());
      boards.push(`${labels.join()}|${ports}`);
    }
    expect(boards[0]).not.toEqual(boards[1]);
  });

  test('the highest roll places first after tied players roll again, setup goes 1, 2, 3, 3, 2, 1 and the second settlement takes its resources', async ({ seat, browser, server }) => {
    const table = await seat('catan', ['Alice', 'Bob']);
    const cara = await newPlayer(browser, server);
    try {
      // Alice and Bob tie on 12 over Cara's 2, then Bob's 8 beats Alice's 3
      await table.random(...lobbyValues([6, 6, 6, 6, 1, 1, 1, 2, 4, 4]));
      await joinGame(cara, 'catan', table.gameId, 'Cara');
      const [alice, bob] = table.pages;
      const everyone = [alice, bob, cara];
      await expect(status(bob)).toHaveText(
        'Cara joined (3/4 players). Highest roll goes first: Alice 12, Bob 12, Cara 2; tie: Alice 3, Bob 8. Bob goes first');
      await expect(turnMessage(bob)).toHaveText('You place first. Joining closes after the first move.');
      await expect(turnMessage(alice)).toHaveText('Bob places first. Joining closes after the first move.');
      for (const page of everyone) await expect(page.locator('.house-rules-list li')).toHaveCount(3);
      await agreeToHouseRules(...everyone); // a join clears every agreement

      const order: [Page, string, number][] = [
        [bob, 'Bob', corner(9, 0)], [cara, 'Cara', corner(0, 0)], [alice, 'Alice', corner(2, 0)],
        [alice, 'Alice', corner(16, 3)], [cara, 'Cara', corner(18, 3)], [bob, 'Bob', corner(14, 0)]
      ];
      for (const [index, [page, name, spot]] of order.entries()) {
        for (const other of everyone.filter(each => each !== page)) {
          await expect(other.locator('.turn-waiting')).toHaveText(`Waiting for ${name} to place a settlement`);
        }
        await expect(page.getByText(SETTLEMENT_PROMPT)).toBeVisible();
        await vertex(page, spot).click();
        await clickPath(page, VERTEX_EDGES[spot][0]);
        if (index < 3) await expectHand(page, {}); // a first settlement takes nothing
      }

      const { layout } = await table.state<GameState>();
      for (const [page, , spot] of order.slice(3)) {
        const around: Hand = {};
        for (const touching of VERTEX_HEXES[spot]) {
          const resource = layout.hexes[touching].resource;
          if (resource) around[resource] = (around[resource] ?? 0) + 1;
        }
        await expectHand(page, around);
      }
      await expect(status(bob)).toContainText('Setup is over: Bob rolls first');
      await expect(button(bob, 'Roll the dice')).toBeVisible();
    } finally {
      await cara.context().close();
    }
  });

  test('no settlement or city may be on an intersection next to another one, in setup or after', async ({ seat }) => {
    const table = await seat('catan', NAMES);
    const { setup } = await table.state<GameState>();
    if (!setup) throw new Error('Expected setup');
    const [first, second] = [table.pages[setup.order[0] - 1], table.pages[setup.order[1] - 1]];
    const spot = corner(9, 0);
    await vertex(first, spot).click();
    await clickPath(first, VERTEX_EDGES[spot][0]);
    await expect(second.getByText(SETTLEMENT_PROMPT)).toBeVisible();
    await expect(vertex(second, spot)).toHaveCount(0);
    for (const neighbour of VERTEX_NEIGHBORS[spot]) await expect(vertex(second, neighbour)).toHaveCount(0);
    await expect(vertex(second, corner(9, 3))).toHaveCount(1);

    // After setup: Alice's road reaches corner 1, next to Bob's city on corner 0, and corner 2, which is free
    await craft(table, { rolled: true, roads: roadsOf(1, ring(9, 0, 2)), buildings: { [corner(9, 0)]: city(2) }, hands: { 1: SETTLEMENT } });
    const alice = table.pages[0];
    await button(alice, 'Build settlement').click();
    await expect(vertex(alice, corner(9, 2))).toHaveCount(1);
    await expect(vertex(alice, corner(9, 1))).toHaveCount(0);
  });

  test('a turn is roll, then trade and build, then end; each settlement on a rolled hex takes one and each city two, except under the robber', async ({ seat }) => {
    // Hex 0 is forest with a 2: Alice's settlement and Bob's city are on it
    const buildings = { [corner(0, 0)]: settlement(1), [corner(0, 3)]: city(2) };
    const { table, pages: [alice, bob, cara] } = await start(seat, { buildings });
    await expect(button(alice, 'End turn')).toHaveCount(0);
    await expect(button(alice, 'Build road')).toHaveCount(0);
    await roll(table, alice, 1, 1);
    await expectHand(alice, { wood: 1 });
    await expectHand(bob, { wood: 2 });
    await expectHand(cara, {});
    await expect(button(alice, 'Build road')).toBeVisible();
    await expect(button(alice, 'Roll the dice')).toHaveCount(0);
    await button(alice, 'End turn').click();
    await expect(turnMessage(bob)).toHaveText('Your turn');

    await craft(table, { buildings, robber: 0 });
    await roll(table, alice, 1, 1);
    await expect(status(alice)).toContainText('Nobody produced anything');
    await expectHand(alice, {});
    await expectHand(bob, {});
  });

  test('on a 7 nobody produces, players over 7 cards give back half, then the roller moves the robber and steals a random card', async ({ seat }) => {
    // Bob's settlement is on hex 4 (pasture); he holds 9 cards and Cara 7
    const { table, pages: [alice, bob, cara] } = await start(seat, {
      buildings: { [corner(4, 0)]: settlement(2) }, hands: { 2: { sheep: 9 }, 3: { ore: 7 } }
    });
    await roll(table, alice, 3, 4);
    await expect(bob.getByRole('region', { name: 'Discard' })).toContainText('A 7: discard 4 cards');
    await expect(cara.getByRole('region', { name: 'Discard' })).toHaveCount(0);
    await expect(alice.locator('.turn-waiting')).toHaveText('Waiting for discards: Bob (4)');
    await expect(alice.locator('.hex-target')).toHaveCount(0);

    await counter(bob, 'One more sheep', 4);
    await button(bob, 'Discard 4 of 4').click();
    await expect(alice.getByText('Move the robber: click a highlighted hex.')).toBeVisible();
    await expect(alice.locator('.hex-target')).toHaveCount(18);
    await expect(hex(alice, 18)).not.toHaveClass(/hex-target/); // the robber must move to another hex
    await table.random(0);
    await hex(alice, 4).click();
    await expectHand(alice, { sheep: 1 });
    await expectHand(bob, { sheep: 4 });
    await expectHand(cara, { ore: 7 });
    await expect(bankCount(alice, 'Sheep')).toHaveText('Sheep 14');

    // A player with no cards cannot be stolen from
    await craft(table, { rolled: true, dice: [3, 4], pending: { kind: 'robber' }, buildings: { [corner(4, 0)]: settlement(2) } });
    await hex(alice, 4).click();
    await expect(status(alice)).toHaveText('Alice moved the robber');
    await expect(alice.getByText('Steal from')).toHaveCount(0);
  });

  test('roads, settlements, cities and development cards cost their resources and follow the placement rules and piece limits', async ({ seat }) => {
    const home = corner(9, 0);
    const [road1, road2] = ring(9, 0, 2);
    const { table, pages: [alice] } = await start(seat, {
      rolled: true, buildings: { [home]: settlement(1) }, hands: { 1: { wood: 3, brick: 3, sheep: 1, wheat: 3, ore: 3 } }
    });
    await button(alice, 'Build road').click();
    await expect(path(alice, road2)).toHaveCount(0); // joins nothing of Alice's yet
    await clickPath(alice, road1);
    await expectHand(alice, { wood: 2, brick: 2, sheep: 1, wheat: 3, ore: 3 });
    await button(alice, 'Build road').click();
    await clickPath(alice, road2);
    await expect(alice.locator('.road.seat1')).toHaveCount(2);

    await button(alice, 'Build settlement').click();
    await expect(vertex(alice, corner(9, 1))).toHaveCount(0); // next to her settlement
    await vertex(alice, corner(9, 2)).click();
    await expectHand(alice, { wheat: 2, ore: 3 });
    await button(alice, 'Build city').click();
    await expect(vertex(alice, corner(9, 2))).toHaveCount(1);
    await vertex(alice, home).click();
    await expect(piece(alice, "Alice's city")).toHaveCount(1);
    await expect(piece(alice, "Alice's settlement")).toHaveCount(1);
    await expectHand(alice, {});

    await craft(table, { rolled: true, hands: { 1: DEV_CARD } });
    await button(alice, 'Buy development card').click();
    await expectHand(alice, {});
    await expect(devCardRow(alice, 'Knight')).toBeVisible();

    // A road cannot join Alice's road through Bob's settlement, but joins her own settlement
    await craft(table, {
      rolled: true, roads: roadsOf(1, [road1]), buildings: { [corner(9, 1)]: settlement(2), [corner(9, 5)]: settlement(1) }, hands: { 1: ROAD }
    });
    await button(alice, 'Build road').click();
    await expect(path(alice, edgeBetween(corner(9, 5), corner(9, 4)))).toHaveCount(1);
    await expect(path(alice, road2)).toHaveCount(0);
    await button(alice, 'Cancel').click();

    // 15 roads: none left
    await craft(table, { rolled: true, roads: roadsOf(1, EDGES.map((_, edge) => edge).slice(0, 15)), hands: { 1: ROAD } });
    await expect(button(alice, 'Build road')).toBeDisabled();
    await expect(button(alice, 'Build road')).toHaveAttribute('title', 'Nowhere to build a road');

    // 5 settlements: none left until one becomes a city and its piece comes back
    const five = [corner(9, 0), corner(9, 2), corner(9, 4), corner(0, 0), corner(2, 0)];
    const spot = corner(11, 0);
    await craft(table, {
      rolled: true, buildings: Object.fromEntries(five.map(at => [at, settlement(1)])), roads: roadsOf(1, [VERTEX_EDGES[spot][0]]),
      hands: { 1: { wood: 1, brick: 1, sheep: 1, wheat: 3, ore: 3 } }
    });
    await expect(button(alice, 'Build settlement')).toHaveAttribute('title', 'Nowhere to build a settlement');
    await button(alice, 'Build city').click();
    await vertex(alice, five[0]).click();
    await button(alice, 'Build settlement').click();
    await vertex(alice, spot).click();
    await expect(alice.locator('.building.seat1')).toHaveCount(6);

    // 4 cities: none left
    await craft(table, {
      rolled: true, hands: { 1: { wheat: 2, ore: 3 } },
      buildings: { ...Object.fromEntries(five.slice(0, 4).map(at => [at, city(1)])), [five[4]]: settlement(1) }
    });
    await expect(button(alice, 'Build city')).toHaveAttribute('title', 'Nowhere to build a city');
  });

  test('the bank holds 19 of each resource, a short roll pays nobody unless one player is owed, and a trade or Year of Plenty it cannot pay is refused', async ({ seat }) => {
    const table = await seat('catan', NAMES);
    for (const resource of ['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore']) {
      await expect(bankCount(table.pages[0], resource)).toHaveText(`${resource} 19`);
    }
    await checkBankShortage(seat);

    const { pages: [alice] } = await start(seat, {
      rolled: true, hands: { 1: { wood: 4 } }, bank: { ore: 1 }, devCards: { 1: ['yearOfPlenty'], 2: [], 3: [] }
    });
    await alice.getByLabel('First resource').selectOption('ore');
    await alice.getByLabel('Second resource').selectOption('ore');
    await devCardRow(alice, 'Year of Plenty').getByRole('button', { name: 'Play' }).click();
    await expect(status(alice)).toHaveText('The bank does not have those cards');
    await expectHand(alice, { wood: 4 });
  });

  test('a bank trade after rolling is 4:1, 3:1 at a 3:1 port and 2:1 for a port\'s own resource', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat, { hands: { 1: { wood: 4 } } });
    await expect(alice.getByLabel('Give to the bank')).toHaveCount(0); // not before the roll
    await roll(table, alice, 1, 1);
    await expect(alice.getByLabel('Give to the bank').locator('option[value="wood"]')).toHaveText('4 Wood');
    await alice.getByLabel('Take from the bank').selectOption('ore');
    await button(alice, 'Trade').click();
    await expectHand(alice, { ore: 1 });

    // The fixed board's first port is 3:1 and its fifth is wood 2:1
    const generic = EDGES[LAYOUT.ports[0].edge][0];
    await craft(table, { rolled: true, buildings: { [generic]: settlement(1) }, hands: { 1: { brick: 3 } } });
    await alice.getByLabel('Give to the bank').selectOption('brick');
    await expect(alice.getByLabel('Give to the bank').locator('option[value="brick"]')).toHaveText('3 Brick');
    await button(alice, 'Trade').click();
    await expectHand(alice, { ore: 1 });

    const woodPort = EDGES[LAYOUT.ports[4].edge][1];
    await craft(table, { rolled: true, buildings: { [woodPort]: settlement(1) }, hands: { 1: { wood: 2, brick: 3 } } });
    await alice.getByLabel('Give to the bank').selectOption('wood');
    await expect(alice.getByLabel('Give to the bank').locator('option[value="brick"]')).toHaveText('4 Brick');
    await expect(alice.getByLabel('Give to the bank').locator('option[value="wood"]')).toHaveText('2 Wood');
    await button(alice, 'Trade').click();
    await expectHand(alice, { brick: 3, ore: 1 });
  });

  test('the turn holder offers players a trade with cards on both sides and no resource on both, the first to accept trades, and it can be withdrawn', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await start(seat, { rolled: true, hands: { 1: { wood: 2 }, 2: { ore: 1 }, 3: { ore: 2 } } });
    await expect(button(bob, 'Offer a trade to other players')).toHaveCount(0);
    await button(alice, 'Offer a trade to other players').click();
    const send = button(alice, 'Send offer');
    await expect(send).toHaveAttribute('title', 'Each side must give at least one card');
    await counter(alice, 'You give: one more wood', 1);
    await counter(alice, 'You get: one more wood', 1);
    await expect(send).toHaveAttribute('title', 'A resource cannot be on both sides');
    await counter(alice, 'You get: one less wood', 1);
    await counter(alice, 'You get: one more ore', 1);
    await tradePartner(alice).selectOption({ label: 'Bob' });
    await send.click();
    await expect(button(bob, 'Accept')).toBeVisible();
    await expect(button(cara, 'Accept')).toHaveCount(0);
    await button(alice, 'Withdraw offer').click();
    await expect(bob.getByRole('region', { name: 'Trade offer' })).toHaveCount(0);

    // To everyone: Cara accepts first and makes the trade
    await button(alice, 'Offer a trade to other players').click();
    await tradePartner(alice).selectOption({ label: 'Everyone' });
    await counter(alice, 'You give: one more wood', 1);
    await counter(alice, 'You get: one more ore', 1);
    await send.click();
    await expect(button(bob, 'Accept')).toBeVisible();
    await button(cara, 'Accept').click();
    await expectHand(alice, { wood: 1, ore: 1 });
    await expectHand(cara, { wood: 1, ore: 1 });
    await expectHand(bob, { ore: 1 });
    await expect(button(bob, 'Accept')).toHaveCount(0);
  });

  test('development cards: the deck mix, one a turn even before rolling, not one bought that turn, and what each card does', async ({ seat }) => {
    const table = await seat('catan', NAMES);
    const { devDeck } = await table.state<GameState>();
    const mix = (cards: string[]) => Object.fromEntries(['knight', 'victoryPoint', 'roadBuilding', 'yearOfPlenty', 'monopoly']
      .map(card => [card, cards.filter(each => each === card).length]));
    expect(mix(devDeck)).toEqual({ knight: 14, victoryPoint: 5, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2 });
    expect(devDeck).not.toEqual(DEV_DECK);

    const [alice, bob, cara] = table.pages;
    const home = corner(9, 0);
    await craft(table, {
      buildings: { [home]: settlement(1) }, hands: { 1: DEV_CARD, 2: { wheat: 3, sheep: 6 }, 3: { wheat: 2 } },
      devCards: { 1: ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly', 'victoryPoint'], 2: [], 3: [] }
    });
    const play = (card: string) => devCardRow(alice, card).getByRole('button', { name: 'Play' });
    await expect(devCardRow(alice, 'Victory Point').getByRole('button')).toHaveCount(0);
    await expect(play('Knight')).toBeEnabled(); // before rolling
    await play('Knight').click();
    await expect(alice.getByText('Move the robber: click a highlighted hex.')).toBeVisible();
    await expect(bob.getByRole('region', { name: 'Discard' })).toHaveCount(0); // a Knight has no discards
    await hex(alice, 0).click();
    await expect(button(alice, 'Roll the dice')).toBeVisible();
    await expect(play('Road Building')).toBeDisabled(); // one a turn

    await roll(table, alice, 1, 2);
    await button(alice, 'Buy development card').click();
    await expect(alice.locator('.dev-card-new')).toContainText('Knight');
    await expect(alice.locator('.dev-card-new')).toContainText('bought this turn');
    await expect(alice.locator('.dev-card-new').getByRole('button')).toHaveCount(0);

    await settle(table, { devPlayed: false });
    await play('Road Building').click();
    await expect(alice.getByText('Place 2 free roads: click a highlighted path.')).toBeVisible();
    const [road1, road2] = ring(9, 0, 2);
    await clickPath(alice, road1);
    await clickPath(alice, road2);
    await expect(alice.locator('.road.seat1')).toHaveCount(2);
    await expectHand(alice, {});

    await settle(table, { devPlayed: false });
    await alice.getByLabel('First resource').selectOption('ore');
    await alice.getByLabel('Second resource').selectOption('ore');
    await play('Year of Plenty').click();
    await expectHand(alice, { ore: 2 });

    await settle(table, { devPlayed: false });
    await alice.getByLabel('Resource to take').selectOption('wheat');
    await play('Monopoly').click();
    await expectHand(alice, { wheat: 5, ore: 2 });
    await expectHand(bob, { sheep: 6 });
    await expectHand(cara, {});

    // The Victory Point card is a point Alice sees and the others do not
    await expect(row(alice, 'Alice').locator('.player-points')).toHaveText('2 pts');
    await expect(row(bob, 'Alice').locator('.player-points')).toHaveText('1 pts');
  });

  test('Longest Road goes to the first single line of 5, moves only to a longer one, and a break hands it on, keeps it in a tie or sets it aside', async ({ seat }) => {
    const line = ring(9, 0, 5); // corners 0 to 5 of the middle hex
    const six = [...line, outward(9, 5)];
    const award = (page: Page, name: string) => row(page, name).locator('.award', { hasText: 'Longest Road' });
    const { table, pages: [alice] } = await start(seat, { rolled: true, roads: roadsOf(1, line.slice(0, 4)), hands: { 1: { wood: 2, brick: 2 } } });

    // A branch adds nothing: still a line of 4
    await button(alice, 'Build road').click();
    await clickPath(alice, outward(9, 2));
    await expect(row(alice, 'Alice')).toContainText('Road 4');
    await expect(award(alice, 'Alice')).toHaveCount(0);
    await button(alice, 'Build road').click();
    await clickPath(alice, line[4]);
    await expect(award(alice, 'Alice')).toBeVisible();
    await expect(row(alice, 'Alice').locator('.player-points')).toHaveText('2 pts');

    // Bob ties at 5 and does not take it; at 6 he does
    const bob = ring(0, 0, 6);
    await craft(table, {
      turnHolder: 2, rolled: true, longestRoad: 1, roads: { ...roadsOf(1, line), ...roadsOf(2, bob.slice(0, 4)) }, hands: { 2: { wood: 2, brick: 2 } }
    });
    const bobPage = table.pages[1];
    await button(bobPage, 'Build road').click();
    await clickPath(bobPage, bob[4]);
    await expect(row(alice, 'Bob')).toContainText('Road 5');
    await expect(award(alice, 'Alice')).toBeVisible();
    await button(bobPage, 'Build road').click();
    await clickPath(bobPage, bob[5]);
    await expect(award(alice, 'Bob')).toBeVisible();
    await expect(award(alice, 'Alice')).toHaveCount(0);

    // Bob's settlement breaks Alice's 6 at one corner; Cara has 5 elsewhere
    const breakAt = async (k: number, roads: Record<number, number>) => {
      await craft(table, { turnHolder: 2, rolled: true, longestRoad: 1, roads: { ...roads, [outward(9, k)]: 2 }, hands: { 2: SETTLEMENT } });
      await button(bobPage, 'Build settlement').click();
      await vertex(bobPage, corner(9, k)).click();
    };
    const cara = roadsOf(3, ring(17, 0, 5));
    await breakAt(2, { ...roadsOf(1, six), ...cara }); // leaves Alice 4: Cara is longest
    await expect(row(alice, 'Alice')).toContainText('Road 4');
    await expect(award(alice, 'Cara')).toBeVisible();

    await breakAt(1, { ...roadsOf(1, six), ...cara }); // leaves Alice 5, tied with Cara: Alice keeps it
    await expect(row(alice, 'Alice')).toContainText('Road 5');
    await expect(award(alice, 'Alice')).toBeVisible();

    await breakAt(2, { ...roadsOf(1, six), ...cara, ...roadsOf(2, ring(0, 0, 5)) }); // Bob and Cara tie at 5 without Alice
    await expect(status(alice)).toContainText('Nobody holds Longest Road now');
    await expect(alice.locator('.award', { hasText: 'Longest Road' })).toHaveCount(0);

    await breakAt(2, roadsOf(1, line)); // nobody left at 5
    await expect(row(alice, 'Alice')).toContainText('Road 3');
    await expect(alice.locator('.award', { hasText: 'Longest Road' })).toHaveCount(0);
  });

  test('Largest Army goes to the first to play 3 Knights and moves only to a player who has played more', async ({ seat }) => {
    const award = (page: Page, name: string) => row(page, name).locator('.award', { hasText: 'Largest Army' });
    const { table, pages: [alice, bob] } = await start(seat, { knights: { 1: 2, 2: 2, 3: 0 }, devCards: { 1: ['knight'], 2: [], 3: [] } });
    const knight = async (page: Page, robberTo: number) => {
      await devCardRow(page, 'Knight').getByRole('button', { name: 'Play' }).click();
      await hex(page, robberTo).click();
      await expect(button(page, 'Roll the dice')).toBeVisible();
    };
    await knight(alice, 0);
    await expect(row(alice, 'Alice')).toContainText('Knights 3');
    await expect(award(alice, 'Alice')).toBeVisible();

    const bobsTurn = { turnHolder: 2, currentPlayer: 2, devPlayed: false, rolled: false, devCards: { 1: [], 2: ['knight'], 3: [] } };
    await settle(table, bobsTurn);
    await knight(bob, 1);
    await expect(row(alice, 'Bob')).toContainText('Knights 3');
    await expect(award(alice, 'Alice')).toBeVisible();

    await settle(table, bobsTurn);
    await knight(bob, 2);
    await expect(row(alice, 'Bob')).toContainText('Knights 4');
    await expect(award(alice, 'Bob')).toBeVisible();
    await expect(award(alice, 'Alice')).toHaveCount(0);
  });

  test('settlements, cities and award cards score, 10 points on your own turn wins at once, and 10 on another\'s turn wins when yours begins', async ({ seat }) => {
    // Four cities and a settlement are 9; Longest Road takes Alice to 11
    const cities = [corner(9, 0), corner(9, 2), corner(9, 4), corner(0, 0)];
    const buildings = (seat: number) => ({ ...Object.fromEntries(cities.map(at => [at, city(seat)])), [corner(2, 0)]: settlement(seat) });
    const { table, pages: [alice, bob] } = await start(seat, {
      rolled: true, buildings: buildings(1), roads: roadsOf(1, ring(9, 0, 4)), hands: { 1: ROAD }
    });
    await expect(row(bob, 'Alice').locator('.player-points')).toHaveText('9 pts');
    await button(alice, 'Build road').click();
    await clickPath(alice, ring(9, 4, 1)[0]);
    await expect(status(bob)).toContainText('Alice wins with 11 points');
    await expect(turnMessage(bob)).toHaveText('Game over: Alice won');

    // Bob holds 9 in buildings and a Victory Point card during Alice's turn
    await craft(table, { rolled: true, buildings: buildings(2), devCards: { 1: [], 2: ['victoryPoint'], 3: [] } });
    await expect(row(bob, 'Bob').locator('.player-points')).toHaveText('10 pts');
    await expect(turnMessage(alice)).toHaveText('Your turn');
    await button(alice, 'End turn').click();
    await expect(turnMessage(alice)).toHaveText('Game over: Bob won');
  });

  test('hands, development cards and stolen cards stay hidden, Victory Points are left out until the end, and only a game file shows hands', async ({ seat, browser, server }, testInfo) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, {
      rolled: true, dice: [3, 4], pending: { kind: 'robber' }, buildings: { [corner(4, 0)]: settlement(2) },
      hands: { 1: { wood: 3 }, 2: { sheep: 2 } }, devCards: { 1: ['knight'], 2: [], 3: [] }
    });
    await expectHand(bob, { sheep: 2 });
    await expect(row(bob, 'Alice')).toContainText('Cards 3');
    await expect(row(bob, 'Alice')).toContainText('Dev 1');
    await expect(bob.getByRole('list', { name: 'Your development cards' })).toHaveCount(0);
    await expect(alice.getByRole('list', { name: 'Your development cards' })).toContainText('Knight');
    await expect(bankCount(bob, 'Dev')).toHaveText('Dev 25'); // the deck is only a count

    await table.random(0);
    await hex(alice, 4).click();
    await expect(alice.locator('.steal-note')).toHaveText('You stole 1 sheep from Bob');
    await expect(bob.locator('.steal-note')).toHaveText('Alice stole your sheep');
    await expect(status(cara)).toHaveText('Alice moved the robber. Alice stole a card from Bob');
    await expect(cara.locator('.steal-note')).toHaveCount(0);

    await button(cara, 'History').click();
    const history = cara.getByRole('dialog', { name: 'History' });
    await expect(history.locator('.player-list')).toBeVisible();
    await expect(history.locator('.hand-panel')).toHaveCount(0);
    await expect(history.getByLabel('View as')).toHaveCount(0);
    await history.getByRole('button', { name: 'Close' }).click();

    // Alice has 8 points in cities and a Victory Point card, then buys another
    const cities = [corner(9, 0), corner(9, 2), corner(9, 4), corner(0, 0)];
    await craft(table, {
      rolled: true, buildings: Object.fromEntries(cities.map(at => [at, city(1)])), hands: { 1: { ...DEV_CARD, wood: 3 } },
      devCards: { 1: ['victoryPoint'], 2: [], 3: [] }, devDeck: ['victoryPoint', 'knight']
    });
    await expect(row(alice, 'Alice').locator('.player-points')).toHaveText('9 pts');
    await expect(row(bob, 'Alice').locator('.player-points')).toHaveText('8 pts');
    await button(alice, 'Buy development card').click();
    await expect(turnMessage(bob)).toHaveText('Game over: Alice won');
    await expect(row(bob, 'Alice').locator('.player-points')).toHaveText('10 pts');

    await button(bob, 'History').click();
    const downloading = bob.waitForEvent('download');
    await bob.getByRole('dialog', { name: 'History' }).getByRole('button', { name: 'Download game' }).click();
    const file = testInfo.outputPath('catan-game.json');
    await (await downloading).saveAs(file);
    const visitor = await newPlayer(browser, server);
    await visitor.goto('/');
    await visitor.locator('input[type="file"]').setInputFiles(file);
    const saved = visitor.getByRole('dialog', { name: 'History' });
    await expect(saved.locator('.hand-panel')).toHaveCount(0);
    await saved.getByLabel('View as').selectOption({ label: 'Alice' });
    await expect(saved.locator('.hand-panel .res-wood .resource-count')).toHaveText('3');
    await visitor.context().close();
  });

  test('a dismissed player\'s pieces stay as dead pieces, their cards and awards go, and their turn or setup placements are skipped; under three players the leader wins', async ({ seat }) => {
    // Dan's dead settlement sits in the middle of Alice's line on the middle hex, on two 8 hexes
    const { table, pages: [alice, bob, cara, dan] } = await start(seat, {
      turnHolder: 4, rolled: true,
      buildings: { [corner(9, 2)]: settlement(4), [corner(16, 3)]: city(1), [corner(0, 0)]: city(1), [corner(17, 3)]: settlement(2) },
      roads: { ...roadsOf(1, ring(9, 0, 5)), [outward(9, 2)]: 4 },
      hands: { 1: SETTLEMENT, 4: { wood: 5 } }, devCards: { 1: [], 2: ['victoryPoint'], 3: [], 4: ['knight', 'victoryPoint'] },
      knights: { 1: 0, 2: 3, 3: 0, 4: 4 }, largestArmy: 4
    }, FOUR);
    await expect(row(alice, 'Alice')).toContainText('Road 3');
    await leave(dan);
    await dropped(alice, 'Dan');
    await expect(turnMessage(alice)).toHaveText("Dan's turn"); // the turn waits
    await dismiss('Dan', alice, bob, cara);

    await expect(turnMessage(alice)).toHaveText('Your turn');
    await expect(row(alice, 'Dan')).toContainText('left');
    await expect(row(alice, 'Dan')).toContainText('Dev 0');
    await expect(alice.locator('.building.seat4')).toHaveClass(/piece-dead/);
    await expect(alice.locator('.road.seat4')).toHaveClass(/piece-dead/);
    await expect(bankCount(alice, 'Wood')).toHaveText('Wood 18'); // Dan's 5 back; Alice holds 1
    await expect(bankCount(alice, 'Dev')).toHaveText('Dev 25'); // his cards leave the game
    await expect(row(alice, 'Bob').locator('.award', { hasText: 'Largest Army' })).toBeVisible();

    await roll(table, alice, 4, 4);
    await expect(status(alice)).toContainText('Nobody produced anything');
    await expect(bankCount(alice, 'Wheat')).toHaveText('Wheat 18');
    await button(alice, 'Build settlement').click();
    await expect(vertex(alice, corner(9, 4))).toHaveCount(1);
    await expect(vertex(alice, corner(9, 1))).toHaveCount(0);
    await expect(vertex(alice, corner(9, 3))).toHaveCount(0);
    await expect(row(alice, 'Alice')).toContainText('Road 3');

    // Down to two: Alice's two cities tie Bob's settlement, hidden Victory Point and Largest Army
    await leave(cara);
    await dropped(alice, 'Cara');
    await dismiss('Cara', alice, bob);
    await expect(status(alice)).toContainText('Too few players are left to go on: Alice and Bob win with 4 points');
    await expect(turnMessage(bob)).toHaveText('Game over: Alice and Bob won');
  });

  test('a dismissed player\'s dead pieces score nothing', async ({ seat }) => {
    const { pages: [alice, bob, cara, dan] } = await start(seat, { buildings: { [corner(9, 0)]: settlement(4) } }, FOUR);
    await expect(row(alice, 'Dan').locator('.player-points')).toHaveText('1 pts');
    await leave(dan);
    await dropped(alice, 'Dan');
    await dismiss('Dan', alice, bob, cara);
    await expect(row(alice, 'Dan')).toContainText('left');
    await expect(row(alice, 'Dan').locator('.player-points')).toHaveText('0 pts');
  });

  test('a player dismissed during setup has their remaining placements skipped', async ({ seat }) => {
    const table = await seat('catan', FOUR);
    const { setup } = await table.state<GameState>();
    if (!setup) throw new Error('Expected setup');
    const pageOf = (seatNumber: number) => table.pages[seatNumber - 1];
    const [first, gone, third, fourth] = setup.order.slice(0, 4);
    const place = async (seatNumber: number) => {
      const page = pageOf(seatNumber);
      await expect(page.getByText(SETTLEMENT_PROMPT)).toBeVisible();
      await page.locator('.vertex-target').first().click();
      await page.locator('.edge-target').first().click({ force: true });
    };
    await place(first);
    const goneName = FOUR[gone - 1];
    await leave(pageOf(gone));
    await dropped(pageOf(first), goneName);
    await dismiss(goneName, pageOf(first), pageOf(third), pageOf(fourth));
    for (const next of [third, fourth, fourth, third, first]) await place(next);
    await expect(status(pageOf(first))).toContainText(`Setup is over: ${FOUR[first - 1]} rolls first`);
    await expect(pageOf(first).locator(`.building.seat${gone}`)).toHaveCount(0);
  });

  test('an offer to a disconnected player is dropped, their discard is made at random, and their turn waits for them to rejoin', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, { hands: { 1: { wood: 1 }, 2: { ore: 1 }, 3: { ore: 8 } } });
    await leave(cara);
    await dropped(alice, 'Cara');
    await roll(table, alice, 3, 4);
    await expect(row(alice, 'Cara')).toContainText('Cards 4');
    await expect(alice.getByText('Move the robber: click a highlighted hex.')).toBeVisible();
    await hex(alice, 0).click();

    await button(alice, 'Offer a trade to other players').click();
    await tradePartner(alice).selectOption({ label: 'Bob' });
    await counter(alice, 'You give: one more wood', 1);
    await counter(alice, 'You get: one more ore', 1);
    await button(alice, 'Send offer').click();
    await expect(button(bob, 'Accept')).toBeVisible();
    await bob.goto('about:blank'); // Bob's connection drops; his tab keeps his seat key
    await expect(status(alice)).toHaveText('The open trade offer was dropped');
    await expect(alice.getByRole('region', { name: 'Trade offer' })).toHaveCount(0);

    await button(alice, 'End turn').click();
    await expect(turnMessage(alice)).toHaveText("Bob's turn");
    await expect(alice.getByText('Waiting for Bob to reconnect')).toBeVisible();
    await bob.goto('/'); // reopening the site takes his seat back
    await expect(turnMessage(bob)).toHaveText('Your turn');
    await expect(button(bob, 'Roll the dice')).toBeVisible();
    await expect(turnMessage(alice)).toHaveText("Bob's turn");
  });

  test('an undo needs every player\'s approval and goes back past discards', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, { hands: { 2: { sheep: 9 } } });
    await roll(table, alice, 3, 4);
    await counter(bob, 'One more sheep', 4);
    await button(bob, 'Discard 4 of 4').click();
    await expect(alice.getByText('Move the robber: click a highlighted hex.')).toBeVisible();

    await button(alice, 'Undo').click();
    await button(bob, 'Approve').click();
    await button(cara, 'Decline').click();
    await expect(alice.getByText('Move the robber: click a highlighted hex.')).toBeVisible();
    await expectHand(bob, { sheep: 5 });

    await undo(alice, bob, cara);
    await expect(button(alice, 'Roll the dice')).toBeVisible();
    await expectHand(bob, { sheep: 9 });
  });

  test('the host can set a lower target', async ({ seat }) => {
    // Four cities and a settlement are 9 points, and three roads are too few for Longest Road
    const cities = [corner(9, 0), corner(9, 2), corner(9, 4), corner(0, 0)];
    const table = await seat('catan', NAMES, { houseRules: { targetScore: 8 } });
    await craft(table, {
      rolled: true, buildings: { ...Object.fromEntries(cities.map(at => [at, city(1)])), [corner(2, 0)]: settlement(1) },
      roads: roadsOf(1, ring(9, 0, 3)), hands: { 1: ROAD }
    });
    const [alice, bob] = table.pages;
    await expect(row(bob, 'Alice').locator('.player-points')).toHaveText('9 pts');
    await button(alice, 'Build road').click();
    await clickPath(alice, ring(9, 3, 1)[0]);
    await expect(status(bob)).toContainText('Alice wins with 9 points');
    await expect(turnMessage(bob)).toHaveText('Game over: Alice won');
  });
});

test.describe('Catan controls', () => {
  test('the board shows tokens with 6 and 8 in red and dots for their odds, ports, pieces in their colors, the robber, the last roll and faded dead pieces', async ({ seat }) => {
    const { table, pages: [alice, bob, cara, dan] } = await start(seat, {
      roads: roadsOf(1, [ring(9, 0, 1)[0]]), buildings: { [corner(9, 0)]: settlement(1), [corner(0, 0)]: city(2), [corner(17, 3)]: settlement(4) }
    }, FOUR);
    const reds = await alice.locator('.token-red .token-number').allTextContents();
    expect(reds.sort()).toEqual(['6', '6', '8', '8']);
    for (const token of await alice.locator('.token').all()) {
      const number = Number(await token.locator('.token-number').textContent());
      await expect(token.locator('.token-pip')).toHaveCount(pips(number));
    }
    await expect(alice.locator('.port')).toHaveCount(9);
    await expect(alice.locator('.road.seat1')).toHaveCount(1);
    await expect(piece(alice, "Alice's settlement")).toHaveClass(/seat1/);
    await expect(piece(alice, "Bob's city")).toHaveClass(/seat2/);
    await expect(alice.locator('.robber')).toBeVisible();

    await roll(table, alice, 2, 3);
    const dice = alice.getByRole('img', { name: 'Last roll: 2 and 3, 5 in all' });
    await expect(dice).toBeVisible();
    const [diceBox, boardBox] = [await dice.boundingBox(), await alice.locator('.board-area').boundingBox()];
    if (!diceBox || !boardBox) throw new Error('The dice or board is not drawn');
    expect(diceBox.x - boardBox.x).toBeLessThan(20);
    expect(diceBox.y - boardBox.y).toBeLessThan(20);

    await leave(dan);
    await dropped(alice, 'Dan');
    await dismiss('Dan', alice, bob, cara);
    const dead = alice.locator('.building.seat4');
    await expect(dead).toHaveClass(/piece-dead/);
    expect(await dead.evaluate(element => getComputedStyle(element).opacity)).toBe('0.45');
    await expect(piece(alice, "Alice's settlement")).not.toHaveClass(/piece-dead/);
  });

  test('clickable places are highlighted: white circles on intersections, dashed white lines on paths and orange outlines on hexes', async ({ seat }) => {
    const table = await seat('catan', NAMES);
    const { setup } = await table.state<GameState>();
    if (!setup) throw new Error('Expected setup');
    const placer = table.pages[setup.order[0] - 1];
    const target = placer.locator('.vertex-target').first();
    const fill = await target.evaluate(element => getComputedStyle(element).fill);
    expect(fill).toMatch(/^(rgba\(255, 255, 255, 0\.7\)|color\(srgb 1 1 1 \/ 0\.7\))$/);
    await target.click();
    const mark = placer.locator('.edge-mark').first();
    expect(await mark.evaluate(element => getComputedStyle(element).stroke)).toBe('rgb(255, 255, 255)');
    expect(await mark.evaluate(element => getComputedStyle(element).strokeDasharray)).not.toBe('none');

    await craft(table, { rolled: true, dice: [3, 4], pending: { kind: 'robber' } });
    const outline = table.pages[0].locator('.hex-target > polygon').first();
    expect(await outline.evaluate(element => getComputedStyle(element).stroke)).toBe('rgb(255, 179, 0)');
  });

  test('in setup you click a highlighted intersection for your settlement, then a highlighted path for its road', async ({ seat }) => {
    const table = await seat('catan', NAMES);
    const { setup, playerNames } = await table.state<GameState>();
    if (!setup) throw new Error('Expected setup');
    const placer = table.pages[setup.order[0] - 1];
    const name = playerNames[setup.order[0]];
    const spot = corner(9, 0);
    await expect(placer.locator('.edge-target')).toHaveCount(0);
    await vertex(placer, spot).click();
    await expect(piece(placer, `${name}'s settlement`)).toHaveCount(1);
    await expect(placer.getByText('Place a road next to it: click a highlighted path.')).toBeVisible();
    await expect(placer.locator('.vertex-target')).toHaveCount(0);
    await expect(placer.locator('.edge-target')).toHaveCount(VERTEX_EDGES[spot].length);
    await clickPath(placer, VERTEX_EDGES[spot][0]);
    await expect(placer.locator(`.road.seat${setup.order[0]}`)).toHaveCount(1);
  });

  test('the turn panel has Roll the dice, then the build buttons that highlight and cancel, Buy development card, the bank trade and End turn; greyed buttons say why', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat, { buildings: { [corner(9, 0)]: settlement(1) } });
    const panel = alice.getByRole('region', { name: 'Your turn' });
    await expect(panel.getByRole('button', { name: 'Roll the dice' })).toBeVisible();
    await roll(table, alice, 1, 2);
    for (const name of ['Build road', 'Build settlement', 'Build city', 'Buy development card', 'Trade', 'End turn']) {
      await expect(panel.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(panel.getByLabel('Give to the bank')).toBeVisible();
    await expect(panel.getByLabel('Take from the bank')).toBeVisible();
    await expect(button(alice, 'Build road')).toBeDisabled();
    await expect(button(alice, 'Build road')).toHaveAttribute('title', 'Needs 1 wood and 1 brick');
    await expect(button(alice, 'Buy development card')).toHaveAttribute('title', 'Needs 1 sheep, 1 wheat and 1 ore');
    await expect(button(alice, 'Trade')).toHaveAttribute('title', 'You need 4 wood');

    await craft(table, { rolled: true, buildings: { [corner(9, 0)]: settlement(1) }, hands: { 1: ROAD } });
    await button(alice, 'Build road').click();
    await expect(button(alice, 'Cancel')).toHaveAttribute('aria-pressed', 'true');
    await expect(alice.locator('.edge-target')).toHaveCount(3);
    await button(alice, 'Cancel').click();
    await expect(alice.locator('.edge-target')).toHaveCount(0);
    await expect(button(alice, 'Build road')).toHaveAttribute('aria-pressed', 'false');
  });

  test('after a 7 or a Knight you click a highlighted hex for the robber, and choose the victim in the panel when there are several', async ({ seat }) => {
    // Bob and Cara both have a settlement on hex 4 and a card
    const { table, pages: [alice] } = await start(seat, {
      rolled: true, dice: [3, 4], pending: { kind: 'robber' }, hands: { 2: { sheep: 1 }, 3: { ore: 1 } },
      buildings: { [corner(4, 0)]: settlement(2), [corner(4, 3)]: settlement(3) }
    });
    await hex(alice, 4).click();
    await expect(alice.getByText('Steal from')).toBeVisible();
    await expect(button(alice, 'Bob')).toBeVisible();
    await table.random(0);
    await button(alice, 'Cara').click();
    await expectHand(alice, { ore: 1 });
  });

  test('your cards panel shows your resources and development cards; Play plays one, Year of Plenty and Monopoly ask for resources first, and new cards wait', async ({ seat }) => {
    const { pages: [alice] } = await start(seat, {
      rolled: true, hands: { 1: { wood: 1, ore: 2 } }, devCards: { 1: ['yearOfPlenty', 'monopoly'], 2: [], 3: [] }, boughtThisTurn: ['knight']
    });
    const panel = alice.getByRole('region', { name: 'Your cards' });
    await expectHand(alice, { wood: 1, ore: 2 });
    await expect(devCardRow(alice, 'Year of Plenty').getByLabel('First resource')).toBeVisible();
    await expect(devCardRow(alice, 'Year of Plenty').getByLabel('Second resource')).toBeVisible();
    await expect(devCardRow(alice, 'Monopoly').getByLabel('Resource to take')).toBeVisible();
    await expect(panel.locator('.dev-card-new')).toHaveText('Knightbought this turn');
    await expect(panel.locator('.dev-card-new').getByRole('button')).toHaveCount(0);
    await alice.getByLabel('First resource').selectOption('sheep');
    await alice.getByLabel('Second resource').selectOption('wheat');
    await devCardRow(alice, 'Year of Plenty').getByRole('button', { name: 'Play' }).click();
    await expectHand(alice, { wood: 1, sheep: 1, wheat: 1, ore: 2 });
    await expect(devCardRow(alice, 'Year of Plenty')).toHaveCount(0);
  });

  test('after a 7, a player with more than 7 cards picks cards with + and - in the Discard panel and clicks Discard', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, { hands: { 2: { sheep: 5, ore: 4 } } });
    await roll(table, alice, 3, 4);
    const discard = bob.getByRole('region', { name: 'Discard' });
    await expect(button(bob, 'Discard 0 of 4')).toBeDisabled();
    await counter(bob, 'One more sheep', 3);
    await counter(bob, 'One more ore', 1);
    await expect(discard.getByRole('button', { name: 'One more ore' })).toBeDisabled(); // 4 chosen already
    await counter(bob, 'One less sheep', 1);
    await counter(bob, 'One more ore', 1);
    await expect(button(bob, 'Discard 4 of 4')).toBeEnabled();
    await button(bob, 'Discard 4 of 4').click();
    await expectHand(bob, { sheep: 3, ore: 2 });
    await expect(discard).toHaveCount(0);
  });

  test('Offer a trade opens the form for Everyone or a player, Send offer shows Accept and Decline to them, and the offer can be withdrawn', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await start(seat, { rolled: true, hands: { 1: { wood: 1 }, 2: { ore: 1 }, 3: { ore: 1 } } });
    await button(alice, 'Offer a trade to other players').click();
    const to = tradePartner(alice);
    await expect(to.locator('option')).toHaveText(['Everyone', 'Bob', 'Cara']);
    await counter(alice, 'You give: one more wood', 1);
    await counter(alice, 'You get: one more ore', 1);
    await button(alice, 'Send offer').click();
    for (const page of [bob, cara]) {
      await expect(page.locator('.trade-summary')).toHaveText('Alice offers anyone 1 wood for 1 ore.');
      await expect(button(page, 'Accept')).toBeVisible();
      await expect(button(page, 'Decline')).toBeVisible();
    }
    await button(bob, 'Decline').click();
    await expect(cara.getByText('Waiting for an answer from Cara.')).toBeVisible();
    await button(alice, 'Withdraw offer').click();
    await expect(cara.locator('.trade-summary')).toHaveCount(0);
    await expectHand(alice, { wood: 1 });
  });

  test('the player list shows points, cards, development cards, Knights, longest road and awards, the bank its cards, and Recent events newest first', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, {
      rolled: true, roads: roadsOf(1, ring(9, 0, 5)), longestRoad: 1, largestArmy: 1, knights: { 1: 3, 2: 0, 3: 0 },
      hands: { 1: { wood: 2, ore: 1 } }, devCards: { 1: ['knight', 'monopoly'], 2: [], 3: [] }
    });
    const alices = row(bob, 'Alice');
    await expect(alices.locator('.player-points')).toHaveText('4 pts');
    for (const text of ['Cards 3', 'Dev 2', 'Knights 3', 'Road 5', 'Longest Road', 'Largest Army']) await expect(alices).toContainText(text);
    await expect(bankCount(bob, 'Wood')).toHaveText('Wood 17');
    await expect(bankCount(bob, 'Ore')).toHaveText('Ore 18');
    await expect(bankCount(bob, 'Dev')).toHaveText('Dev 25');

    await button(alice, 'End turn').click();
    await roll(table, bob, 1, 1);
    const events = bob.getByRole('region', { name: 'Recent events' }).locator('li');
    await expect(events.first()).toHaveText('Nobody produced anything');
    await expect(events.nth(1)).toHaveText('Bob rolled 1 and 1');
    await expect(events.nth(2)).toHaveText('Alice ended their turn');
  });

  test('clicking Undo asks everyone to undo the last move', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat);
    await roll(table, alice, 1, 2);
    await button(alice, 'Undo').click();
    await expect(button(bob, 'Approve')).toBeVisible();
    await expect(button(cara, 'Approve')).toBeVisible();
    await expect(button(alice, 'Approve')).toHaveCount(0);
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { pages: [alice] } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('Longest Road');
    await expect(faq).toContainText('Click a highlighted intersection');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});

test.describe('Catan differences from Wikipedia', () => {
  test('the resources are called wood, brick, sheep, wheat and ore', async ({ seat }) => {
    const { pages: [alice] } = await start(seat);
    await expect(alice.locator('.hand-panel .resource-name')).toHaveText(['Wood', 'Brick', 'Sheep', 'Wheat', 'Ore']);
    await expect(alice.getByText(/lumber|wool|grain/i)).toHaveCount(0);
  });

  test('every board is random with 6s and 8s apart, and the ports keep their places while their kinds are shuffled', async ({ seat }) => {
    const ports: { places: string; kinds: string }[] = [];
    for (let game = 0; game < 2; game++) {
      const page = (await seat('catan', NAMES)).pages[0];
      await expect(page.locator('.hex')).toHaveCount(19);
      expect(redsApart(await hexLabels(page))).toBe(true);
      const markers = page.locator('.port circle');
      ports.push({
        places: (await markers.evaluateAll(circles => circles.map(circle => `${circle.getAttribute('cx')},${circle.getAttribute('cy')}`))).sort().join(' '),
        kinds: (await page.locator('.port').evaluateAll(elements => elements.map(element => element.getAttribute('class')))).join()
      });
    }
    expect(ports[0].places).toEqual(ports[1].places);
    expect(ports[0].kinds).not.toEqual(ports[1].kinds);
  });

  test('a resource the bank cannot pay in full goes to nobody, unless a single player is owed it', async ({ seat }) => {
    await checkBankShortage(seat);
  });

  test('the turn holder offers one fixed trade at a time, the first to accept takes it, and the others cannot trade', async ({ seat }) => {
    const { pages: [alice, bob, cara] } = await start(seat, { rolled: true, hands: { 1: { wood: 1 }, 2: { ore: 1 }, 3: { ore: 1 } } });
    for (const page of [bob, cara]) await expect(button(page, 'Offer a trade to other players')).toHaveCount(0);
    await button(alice, 'Offer a trade to other players').click();
    await counter(alice, 'You give: one more wood', 1);
    await counter(alice, 'You get: one more ore', 1);
    await button(alice, 'Send offer').click();
    await expect(button(alice, 'Offer a trade to other players')).toHaveCount(0); // one at a time
    await button(bob, 'Accept').click();
    await expectHand(bob, { wood: 1 });
    await expectHand(cara, { ore: 1 });
    await expect(button(cara, 'Accept')).toHaveCount(0);
  });

  test('each player discards in the Discard panel in any order, and the robber moves once everyone has', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, { hands: { 2: { sheep: 8 }, 3: { ore: 8 } } });
    await roll(table, alice, 3, 4);
    await counter(cara, 'One more ore', 4);
    await button(cara, 'Discard 4 of 4').click();
    await expect(alice.locator('.turn-waiting')).toHaveText('Waiting for discards: Bob (4)');
    await expect(alice.locator('.hex-target')).toHaveCount(0);
    await counter(bob, 'One more sheep', 4);
    await button(bob, 'Discard 4 of 4').click();
    await expect(alice.locator('.hex-target')).toHaveCount(18);
  });

  test('the roller chooses the victim, the card is random, and only the thief and victim are told which it was', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, {
      rolled: true, dice: [3, 4], pending: { kind: 'robber' }, hands: { 2: { sheep: 1, ore: 1 }, 3: { wheat: 1 } },
      buildings: { [corner(4, 0)]: settlement(2), [corner(4, 3)]: settlement(3) }
    });
    await hex(alice, 4).click();
    await table.random(0.75); // the second of Bob's two cards
    await button(alice, 'Bob').click();
    await expectHand(alice, { ore: 1 });
    await expect(bob.locator('.steal-note')).toHaveText('Alice stole your ore');
    await expect(cara.locator('.steal-note')).toHaveCount(0);
    await expect(status(cara)).not.toContainText('ore');
  });

  test('a player who passes 10 points on another\'s turn, when a broken road hands them Longest Road, wins when their own turn begins', async ({ seat }) => {
    // Cara holds Longest Road with 6 on the middle hex; Bob has 8 points in cities and a line of 5
    const bobCities = [corner(16, 3), corner(17, 3), corner(18, 3), corner(12, 4)];
    const { pages: [alice, bob] } = await start(seat, {
      rolled: true, longestRoad: 3, hands: { 1: SETTLEMENT },
      roads: { ...roadsOf(3, [...ring(9, 0, 5), outward(9, 5)]), ...roadsOf(2, ring(0, 0, 5)), [outward(9, 2)]: 1 },
      buildings: Object.fromEntries(bobCities.map(at => [at, city(2)]))
    });
    await button(alice, 'Build settlement').click();
    await vertex(alice, corner(9, 2)).click();
    await expect(row(alice, 'Bob').locator('.award', { hasText: 'Longest Road' })).toBeVisible();
    await expect(row(alice, 'Bob').locator('.player-points')).toHaveText('10 pts');
    await expect(turnMessage(alice)).toHaveText('Your turn');
    await button(alice, 'End turn').click();
    await expect(turnMessage(bob)).toHaveText('Game over: Bob won');
  });

  test('a dismissed player\'s pieces stay as dead pieces and their cards go back to the bank, and under three players the leader wins', async ({ seat }) => {
    const { pages: [alice, bob, cara, dan] } = await start(seat, {
      buildings: { [corner(9, 0)]: settlement(4), [corner(0, 0)]: city(1) }, hands: { 4: { ore: 3 } }
    }, FOUR);
    await leave(dan);
    await dropped(alice, 'Dan');
    await dismiss('Dan', alice, bob, cara);
    await expect(alice.locator('.building.seat4')).toHaveClass(/piece-dead/);
    await expect(bankCount(alice, 'Ore')).toHaveText('Ore 19');
    await leave(cara);
    await dropped(alice, 'Cara');
    await dismiss('Cara', alice, bob);
    await expect(status(bob)).toContainText('Too few players are left to go on: Alice wins with 2 points');
  });
});
