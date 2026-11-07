import type { Page } from '@playwright/test';
import { dismiss, expect, headerButton, inHouseRules, leave, openFaq, test, undo, type Table } from './fixtures.ts';
import { careerOf, houseOf } from '../games/roadtoretirement/content.ts';
import { money } from '../games/roadtoretirement/roadRules.ts';
import type { Cell, GameState, RoadPlayer } from '../games/roadtoretirement/types.ts';

// One test per rule, control and difference in games/roadtoretirement/README.md. Seat 1 is Alice, seat 2 Bob and
// seat 3 Cara. Every spin is made on the server, so each test queues the numbers it needs; careers and houses on
// offer are left to chance and read from the buttons.

const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.turn-message');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const details = (page: Page, seat: number) => page.locator(`.player-row[data-seat="${seat}"] .player-details`);
const rowStatus = (page: Page, seat: number) => page.locator(`.player-row[data-seat="${seat}"] .player-status`);
const panel = (page: Page, name: string) => page.getByRole('region', { name });
const square = (page: Page, { row, col }: Cell) => page.locator(`.checkered-board [data-row="${row}"][data-col="${col}"]`);
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });
const ROAD_GAME = 'roadtoretirement';
const CHECKERED = { houseRules: { board: 'checkered' } };

// Queues the spinner's numbers (1 to 10), then `page` presses Spin
async function spin(table: Table, page: Page, ...numbers: number[]): Promise<void> {
  await table.random(...numbers.map(n => (n - 0.5) / 10));
  await button(page, 'Spin').click();
}

// Queues the teetotum's numbers (1 to 6), then `page` presses Spin
async function twirl(table: Table, page: Page, ...faces: number[]): Promise<void> {
  await table.dice(...faces);
  await button(page, 'Spin').click();
}

// Sets fields of the road players with Alice to spin, and waits until her row shows `aliceShows`
async function road(table: Table, players: Record<number, Partial<RoadPlayer>>, aliceShows: string): Promise<void> {
  const state = await table.state<GameState>();
  const merged = Object.fromEntries(Object.entries(state.road!.players).map(([seat, p]) => [seat, { ...p, ...players[Number(seat)] }]));
  await table.patch({ road: { players: merged, phase: 'spin', stepsLeft: 0, offer: [] }, currentPlayer: 1, lastMove: null, started: true });
  await expect(details(table.pages[0], 1)).toHaveText(aliceShows);
}

// Puts pieces and points on the 1860 board with Alice to spin, and waits until her piece is shown on `at`
async function place(table: Table, at: Cell, points = 0, others: Record<number, Cell> = {}): Promise<void> {
  const board = (await table.state<GameState>()).checkered!;
  await table.patch({
    checkered: { ...board, pieces: { ...board.pieces, ...others, 1: at }, points: { ...board.points, 1: points }, skipNext: [], phase: 'spin', options: [] },
    currentPlayer: 1, lastMove: null, started: true
  });
  await expect(square(table.pages[0], at).locator('.piece.seat1')).toBeVisible();
}

const playerAt = async (table: Table, seat: number): Promise<number> => (await table.state<GameState>()).road!.players[seat].space;

test.describe('Road to Retirement house rules', () => {
  test('House rules list Board with both labels, and Game length and Starting cash disappear with 1860 Checkered', async ({ seat }) => {
    const { pages: [alice] } = await seat(ROAD_GAME, ['Alice']);
    await expect(alice.locator('svg.road-board')).toBeVisible();
    await inHouseRules(alice, async dialog => {
      const board = dialog.getByLabel('Board', { exact: true });
      await expect(board.locator('option')).toHaveText(['Road to Retirement', '1860 Checkered']);
      await expect(board).toHaveValue('road');
      await expect(dialog.getByLabel('Game length', { exact: true }).locator('option')).toHaveText(['Short', 'Full']);
      await expect(dialog.getByLabel('Starting cash', { exact: true }).locator('option')).toHaveText(['$10,000', '$25,000', '$50,000']);
      await board.selectOption({ label: '1860 Checkered' });
      await expect(board).toHaveValue('checkered');
      await expect(dialog.getByLabel('Game length', { exact: true })).toHaveCount(0);
      await expect(dialog.getByLabel('Starting cash', { exact: true })).toHaveCount(0);
    });
    await expect(alice.locator('.checkered-board')).toBeVisible();
    await expect(alice.locator('.spinner-name')).toHaveText('Teetotum, 1 to 6');
  });

  test('a Short game skips the dimmed spaces and Starting cash sets the money', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob'], { houseRules: { length: 'short', startingCash: 50000 } });
    const [alice] = table.pages;
    await expect(details(alice, 1)).toHaveText('$50,000 cash, no career yet');
    await expect(alice.locator('.space[data-space="18"]')).toHaveClass(/skipped/);
    await button(alice, 'Straight to work').click();
    await panel(alice, 'Choose a career').getByRole('button').first().click();
    const salary = money(careerOf((await table.state<GameState>()).road!.players[1].career!)!.salary);
    // From Start: 15 is the work road's job, 16 a payday, 17 a gain, 18 skipped, 19 a payday
    await spin(table, alice, 4);
    await expect(status(alice)).toHaveText(`Alice spun 4, collected ${salary} on payday, collected ${salary} on payday`);
    expect(await playerAt(table, 1)).toBe(19);
  });
});

test.describe('Road to Retirement rules', () => {
  test('College costs $50,000 in loans, Straight to work offers two careers at once', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await expect(panel(bob, 'Choose a route')).toHaveCount(0);
    await expect(panel(alice, 'Choose a route')).toContainText('College costs $50,000 and leads to better careers');
    await button(alice, 'College').click();
    await expect(status(bob)).toHaveText('Alice chose college, took 2 loans of $20,000');
    await expect(details(bob, 1)).toHaveText('$15,000 cash, 2 loans, no career yet');
    // Still Alice's turn: she spins onto the college road
    await spin(table, alice, 3);
    await expect(status(bob)).toHaveText('Alice spun 3, landed on an event: The car needs a new transmission');
    await expect(details(bob, 1)).toHaveText('$13,200 cash, 2 loans, no career yet');
    await expect(turn(bob)).toHaveText('Your turn');
    await button(bob, 'Straight to work').click();
    const careers = panel(bob, 'Choose a career').getByRole('button');
    await expect(careers).toHaveCount(2);
    for (const label of await careers.allTextContents()) {
      expect(Number(label.replace(/.*\$|,/g, ''))).toBeLessThanOrEqual(50000); // no degree needed
    }
    await careers.first().click();
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(button(bob, 'Spin')).toBeEnabled();
  });

  test('a payday passed or landed on pays the salary', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await road(table, { 1: { space: 25, career: 'chef', cash: 25000 } }, '$25,000 cash, Chef, $35,000');
    await spin(table, alice, 3); // past the payday on 27 to a loss on 28
    await expect(status(bob)).toHaveText('Alice spun 3, collected $35,000 on payday, landed on an event: Your phone falls into the lake');
    await expect(details(bob, 1)).toHaveText('$59,600 cash, Chef, $35,000');
    await road(table, { 1: { space: 26, career: 'chef', cash: 25000 } }, '$25,000 cash, Chef, $35,000');
    await spin(table, alice, 1);
    await expect(status(bob)).toHaveText('Alice spun 1, collected $35,000 on payday');
    await expect(details(bob, 1)).toHaveText('$60,000 cash, Chef, $35,000');
  });

  test('a stop space stops a long spin and the rest is lost', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await road(table, { 1: { space: 42, career: 'chef' } }, '$25,000 cash, Chef, $35,000');
    await expect(alice.locator('.space[data-space="45"]')).toHaveClass(/stop/);
    await spin(table, alice, 10);
    await expect(status(bob)).toHaveText('Alice spun 10, found a partner');
    expect(await playerAt(table, 1)).toBe(45);
    await expect(turn(alice)).toHaveText("Bob's turn");
  });

  test('the mid fork pauses the spin for Safe road or Fast lane, then goes on', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await road(table, { 1: { space: 46, career: 'chef' } }, '$25,000 cash, Chef, $35,000');
    await spin(table, alice, 5);
    await expect(status(bob)).toHaveText('Alice spun 5, reached the fork');
    expect(await playerAt(table, 1)).toBe(49);
    await expect(panel(bob, 'Choose a road')).toHaveCount(0);
    await expect(panel(alice, 'Choose a road').getByRole('button')).toHaveText(['Safe road', 'Fast lane']);
    await button(alice, 'Safe road').click();
    await expect(status(bob)).toHaveText('Alice took the safe road, collected $35,000 on payday, landed on an event: You return a lost wallet and get a reward');
    expect(await playerAt(table, 1)).toBe(51);
    // The fast lane starts with a risk space
    await road(table, { 1: { space: 46, career: 'chef', cash: 25000 } }, '$25,000 cash, Chef, $35,000');
    await spin(table, alice, 4);
    await table.random((6 - 0.5) / 10);
    await button(alice, 'Fast lane').click();
    await expect(status(bob)).toHaveText('Alice took the fast lane, spun 6 on a risk, broke even');
    expect(await playerAt(table, 1)).toBe(67);
  });

  test('a job offers two careers and Keep', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await road(table, { 1: { space: 36, career: 'chef' } }, '$25,000 cash, Chef, $35,000');
    await spin(table, alice, 1);
    await expect(status(bob)).toHaveText('Alice spun 1, landed on a job');
    const choices = panel(alice, 'Choose a career').getByRole('button');
    await expect(choices).toHaveCount(3);
    await expect(choices.last()).toHaveText('Keep Chef');
    await expect(choices.first()).not.toHaveText(/^Chef/);
    await button(alice, 'Keep Chef').click();
    await expect(status(bob)).toHaveText('Alice kept their career');
    await expect(turn(bob)).toHaveText('Your turn');
    // Taking an offered career sets the salary
    await road(table, { 1: { space: 36, career: 'chef' } }, '$25,000 cash, Chef, $35,000');
    await spin(table, alice, 1);
    const offered = (await choices.first().textContent())!;
    await choices.first().click();
    await expect(details(bob, 1)).toHaveText(`$25,000 cash, ${offered}`);
  });

  test('a house bought shows in the player list and sells at retirement', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await road(table, { 1: { space: 29, career: 'chef', cash: 400000 } }, '$400,000 cash, Chef, $35,000');
    await spin(table, alice, 1);
    await expect(status(bob)).toHaveText('Alice spun 1, landed on a house');
    const houses = panel(alice, 'Choose a house').getByRole('button');
    await expect(houses).toHaveCount(3);
    await expect(houses.last()).toHaveText('No house');
    await houses.first().click();
    const [id] = (await table.state<GameState>()).road!.players[1].houses;
    const house = houseOf(id)!;
    await expect(status(bob)).toHaveText(`Alice bought the ${house.name} for $${house.price.toLocaleString('en-US')}`);
    await expect(details(bob, 1)).toContainText(`Chef, $35,000, ${house.name}`);
    await road(table, { 1: { space: 114, cash: 0 } }, `$0 cash, Chef, $35,000, ${house.name}`);
    await spin(table, alice, 1);
    const sale = `$${house.saleValue.toLocaleString('en-US')}`;
    await expect(status(bob)).toHaveText(`Alice spun 1, retired with ${sale}`);
    await expect(details(bob, 1)).toHaveText(`retired with ${sale}, Chef, $35,000, ${house.name}`);
  });

  test('a shortfall takes loans of $20,000', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await road(table, { 1: { space: 32, career: 'chef', cash: 5000 } }, '$5,000 cash, Chef, $35,000');
    await spin(table, alice, 1, 2);
    await expect(status(bob)).toHaveText('Alice spun 1, spun 2 on a risk, lost $20,000, took 1 loan of $20,000');
    await expect(details(bob, 1)).toHaveText('$5,000 cash, 1 loan, Chef, $35,000');
  });

  test('a risk space spins again: 8 to 10 wins $50,000, 5 to 7 breaks even', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await road(table, { 1: { space: 32, career: 'chef', cash: 25000 } }, '$25,000 cash, Chef, $35,000');
    await expect(alice.locator('.space[data-space="33"] title')).toHaveText('Risk: spin to win or lose');
    await spin(table, alice, 1, 9);
    await expect(status(bob)).toHaveText('Alice spun 1, spun 9 on a risk, won $50,000');
    await expect(details(bob, 1)).toHaveText('$75,000 cash, Chef, $35,000');
    await road(table, { 1: { space: 32, career: 'chef', cash: 25000 } }, '$25,000 cash, Chef, $35,000');
    await spin(table, alice, 1, 5);
    await expect(status(bob)).toHaveText('Alice spun 1, spun 5 on a risk, broke even');
    await expect(details(bob, 1)).toHaveText('$25,000 cash, Chef, $35,000');
  });

  test('a family space brings a partner, then a child', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await road(table, { 1: { space: 40, career: 'chef' } }, '$25,000 cash, Chef, $35,000');
    await spin(table, alice, 1);
    await expect(status(bob)).toHaveText('Alice spun 1, found a partner');
    await expect(details(bob, 1)).toHaveText('$25,000 cash, Chef, $35,000, partner');
    await road(table, { 1: { space: 40 } }, '$25,000 cash, Chef, $35,000, partner');
    await spin(table, alice, 1);
    await expect(status(bob)).toHaveText('Alice spun 1, had a child');
    await expect(details(bob, 1)).toHaveText('$25,000 cash, Chef, $35,000, partner and 1 child');
  });

  test('retirement counts cash, houses and children less loans, and the richest wins', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    // Alice: $10,000 + the Lake Cabin's $50,000 + one child $25,000 - one loan $25,000 = $60,000
    await road(table, {
      1: { space: 114, career: 'chef', cash: 10000, houses: ['cabin'], partner: true, children: 1, loans: 1 },
      2: { space: 114, career: 'chef', cash: 50000 }
    }, '$10,000 cash, 1 loan, Chef, $35,000, Lake Cabin, partner and 1 child');
    await spin(table, alice, 1);
    await expect(status(bob)).toHaveText('Alice spun 1, retired with $60,000');
    await expect(turn(bob)).toHaveText('Your turn');
    await spin(table, bob, 7);
    await expect(status(alice)).toHaveText('Alice retired the richest with $60,000');
    for (const page of [alice, bob]) {
      await expect(gameOver(page)).toBeVisible();
      await expect(gameOver(page)).toContainText('$60,000');
      await expect(gameOver(page)).toContainText('$50,000');
      await expect(rowStatus(page, 1)).toHaveText('winner');
    }
  });
});

test.describe('1860 Checkered rules', () => {
  test('pieces start on Infancy, bottom left, and Happy Old Age is top right', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob'], CHECKERED);
    const [alice] = table.pages;
    await expect(alice.locator('.checkered-board .cell')).toHaveCount(64);
    await expect(alice.locator('.checkered-board .cell.light .square-name')).toHaveCount(32);
    await expect(square(alice, { row: 7, col: 0 }).locator('.square-name')).toHaveText('Infancy');
    await expect(square(alice, { row: 0, col: 7 }).locator('.square-name')).toHaveText('Happy Old Age');
    await expect(square(alice, { row: 0, col: 7 }).locator('.square-note')).toHaveText('+50, the goal');
    await expect(square(alice, { row: 7, col: 0 }).locator('.piece')).toHaveCount(2);
    await expect(details(alice, 1)).toHaveText('0 points');
  });

  test("each teetotum number's legal squares are highlighted, in light squares", async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob'], CHECKERED);
    const [alice, bob] = table.pages;
    // From Industry (row 4, column 3)
    const expected: Record<number, string[]> = {
      1: ['2,3', '6,3'], 2: ['4,1', '4,5'], 3: ['3,2', '3,4', '5,2', '5,4'], 4: ['0,3', '2,3', '6,3'], 5: ['4,1', '4,5', '4,7'],
      6: ['2,1', '2,5', '3,2', '3,4', '5,2', '5,4', '6,1', '6,5']
    };
    for (const face of [1, 2, 3, 4, 5, 6]) {
      await place(table, { row: 4, col: 3 });
      await twirl(table, alice, face);
      await expect(bob.locator('[data-legal="true"]')).toHaveCount(expected[face].length);
      const shown = await bob.locator('[data-legal="true"]').evaluateAll(cells => cells.map(c => `${c.getAttribute('data-row')},${c.getAttribute('data-col')}`));
      expect(shown.sort()).toEqual(expected[face]);
      await expect(alice.locator('.checkered-board button.legal')).toHaveCount(expected[face].length);
      await expect(turn(alice)).toHaveText('Your turn: pick a highlighted square');
    }
    await button(alice, 'Move to Fame').click();
    await expect(square(bob, { row: 6, col: 5 }).locator('.piece.seat1')).toBeVisible();
  });

  test('a send-on square moves on and scores', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob'], CHECKERED);
    const [alice, bob] = table.pages;
    await expect(square(alice, { row: 6, col: 1 }).locator('.square-note')).toHaveText('to College');
    await twirl(table, alice, 3); // the one diagonal from Infancy is School
    await expect(status(bob)).toHaveText('Alice spun 3, landed on School, went on to College');
    await expect(square(bob, { row: 5, col: 4 }).locator('.piece.seat1')).toBeVisible();
    await expect(details(bob, 1)).toHaveText('5 points');
  });

  test('Speculation spins again: 3 or 6 goes on to Wealth', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob'], CHECKERED);
    const [alice, bob] = table.pages;
    await place(table, { row: 4, col: 5 });
    await twirl(table, alice, 3, 6);
    await button(alice, 'Move to Speculation').click();
    await expect(status(bob)).toHaveText('Alice landed on Speculation, spun 6 on Speculation, went on to Wealth');
    await expect(details(bob, 1)).toHaveText('10 points');
    await place(table, { row: 4, col: 5 });
    await twirl(table, alice, 3, 2);
    await button(alice, 'Move to Speculation').click();
    await expect(status(bob)).toHaveText('Alice landed on Speculation, spun 2 on Speculation, went on to Ruin');
  });

  test('Prison loses the next turn', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob'], CHECKERED);
    const [alice, bob] = table.pages;
    await place(table, { row: 6, col: 5 });
    await twirl(table, alice, 3);
    await button(alice, 'Move to Prison').click();
    await expect(status(bob)).toHaveText('Alice landed on Prison, will lose the next turn');
    await expect(rowStatus(bob, 1)).toHaveText('loses next turn');
    await twirl(table, bob, 2);
    await expect(status(alice)).toHaveText('Bob spun 2, landed on Disgrace');
    await button(alice, 'Spin').click();
    await expect(status(bob)).toHaveText('Alice lost this turn');
    await expect(rowStatus(bob, 1)).toHaveCount(0);
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('Despair sends the player back to Infancy with 0 points', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob'], CHECKERED);
    const [alice, bob] = table.pages;
    await place(table, { row: 6, col: 5 }, 30);
    await expect(details(bob, 1)).toHaveText('30 points');
    await expect(square(bob, { row: 5, col: 6 }).locator('.square-name')).toHaveText('Despair');
    await twirl(table, alice, 3);
    await button(alice, 'Move to Despair').click();
    await expect(status(bob)).toHaveText('Alice landed on Despair, went back to Infancy and lost every point');
    await expect(square(bob, { row: 7, col: 0 }).locator('.piece.seat1')).toBeVisible();
    await expect(details(bob, 1)).toHaveText('0 points');
  });

  test('Happy Old Age with 100 points counting its 50 wins', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob'], CHECKERED);
    const [alice, bob] = table.pages;
    await place(table, { row: 2, col: 7 }, 50);
    await twirl(table, alice, 1);
    await button(alice, 'Move to Happy Old Age').click();
    await expect(status(bob)).toHaveText('Alice reached Happy Old Age with 100 points');
    await expect(gameOver(bob)).toBeVisible();
    await expect(rowStatus(bob, 1)).toHaveText('winner');
  });

  test('arriving short of 100 points, the 50 is not kept and play goes on', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob'], CHECKERED);
    const [alice, bob] = table.pages;
    await place(table, { row: 2, col: 7 }, 40);
    await twirl(table, alice, 1);
    await button(alice, 'Move to Happy Old Age').click();
    await expect(status(bob)).toHaveText('Alice reached Happy Old Age short of 100 points');
    await expect(details(bob, 1)).toHaveText('40 points');
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(gameOver(bob)).toHaveCount(0);
  });
});

test.describe('Road to Retirement controls', () => {
  test('Undo of a spin puts the token back after everyone approves', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await button(alice, 'College').click();
    await spin(table, alice, 3);
    await expect(turn(bob)).toHaveText('Your turn');
    expect(await playerAt(table, 1)).toBe(3);
    await undo(alice, bob);
    await expect(turn(alice)).toHaveText('Your turn');
    await expect(details(bob, 1)).toHaveText('$15,000 cash, 2 loans, no career yet');
    expect(await playerAt(table, 1)).toBe(0);
    await expect(button(alice, 'Spin')).toBeEnabled();
  });

  test("a dismissed player's token leaves the board and their turns are skipped", async ({ seat }) => {
    test.slow(); // three seats plus leave and dismiss flows
    const table = await seat(ROAD_GAME, ['Alice', 'Bob', 'Cara']);
    const [alice, bob, cara] = table.pages;
    await button(alice, 'College').click();
    await spin(table, alice, 3);
    await expect(turn(bob)).toHaveText('Your turn');
    await expect(alice.locator('g.token.seat2')).toHaveCount(1);
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(alice.locator('g.token.seat2')).toHaveCount(0);
    await expect(rowStatus(alice, 2)).toHaveText('left');
    await expect(turn(cara)).toHaveText('Your turn');
    await expect(panel(cara, 'Choose a route')).toBeVisible();
  });

  test('History steps through the moves with the mover outlined', async ({ seat }) => {
    const table = await seat(ROAD_GAME, ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await button(alice, 'College').click();
    await spin(table, alice, 3);
    await expect(turn(bob)).toHaveText('Your turn');
    await (await headerButton(bob, 'History')).click();
    const history = bob.getByRole('dialog', { name: 'History' });
    const step = history.locator('.history-move');
    await expect(step).toHaveText('Move 2 of 2: Alice spun 3. Alice landed on an event: The car needs a new transmission');
    await expect(history.locator('.space.highlight')).toHaveAttribute('data-space', '3');
    await history.getByRole('slider', { name: 'Step' }).press('ArrowLeft');
    await expect(step).toHaveText('Move 1 of 2: Alice chose college. Alice took 2 loans of $20,000');
    await expect(history.locator('.space.highlight')).toHaveAttribute('data-space', '0');
    await expect(history.locator('.player-row[data-seat="1"] .player-details')).toHaveText('$15,000 cash, 2 loans, no career yet');
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { pages: [alice] } = await seat(ROAD_GAME, ['Alice', 'Bob']);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('What are risk spaces?');
    await expect(faq).toContainText('How do I move on the 1860 Checkered board?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});
