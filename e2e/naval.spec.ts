import type { Locator, Page } from '@playwright/test';
import { isDeepStrictEqual } from 'node:util';
import {
  agreeToHouseRules, dismiss, drag, expect, inHouseRules, joinGame, leave, newPlayer, openFaq, seeTable, tableScreen, test,
  touchDrag, undo, watch, type Seat, type Table
} from './fixtures.ts';
import type { Ship, Shot } from '../games/naval/types.ts';

// One test per rule, control and difference in games/naval/README.md. Seat 1 (Alice) fires first, seat 2 (Bob) second.
// Squares are named as on the grid, 'B7': row B, column 7.

const across = (length: Ship['length'], row: number, col: number): Ship => ({ length, row, col, orientation: 'across' });

// Alice's fleet fills rows A to E from column 1; Bob's lies in rows F to I from column 1, with his 2 at J9-J10
const ALICE: Ship[] = [across(5, 0, 0), across(4, 1, 0), across(3, 2, 0), across(3, 3, 0), across(2, 4, 0)];
const BOB: Ship[] = [across(5, 5, 0), across(4, 6, 0), across(3, 7, 0), across(3, 8, 0), across(2, 9, 8)];

const ROWS = 'ABCDEFGHIJ';
const nameOf = (cell: { row: number; col: number }) => `${ROWS[cell.row]}${cell.col + 1}`;

// The squares a ship covers, from its top or left end
const cellsOf = (ship: Ship) => Array.from({ length: ship.length }, (_, i) => ({
  row: ship.row + (ship.orientation === 'down' ? i : 0), col: ship.col + (ship.orientation === 'across' ? i : 0)
}));

// Every shot that sinks `ships`, each ship's last square answered sunk
function sinking(ships: Ship[]): Shot[] {
  return ships.flatMap(ship => cellsOf(ship).map((cell, i): Shot =>
    i === ship.length - 1 ? { ...cell, result: 'sunk', sunkLength: ship.length } : { ...cell, result: 'hit' }));
}

const namesOf = (ships: Ship[]) => ships.flatMap(cellsOf).map(nameOf);

// A page, or a dialog such as History
type Scope = Page | Locator;
const grid = (scope: Scope, label: string) => scope.getByRole('group', { name: label, exact: true });
const square = (scope: Scope, label: string, name: string) => grid(scope, label).getByRole('button', { name, exact: true });
const shipSquares = (scope: Scope, label: string) => grid(scope, label).locator('.ship');
const trayShip = (page: Page, length: number) => page.getByRole('button', { name: `A ship of length ${length}` }).first();
const status = (page: Page) => page.locator('.game-status');
const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });

// Expects exactly `names` to be ship squares on the grid
async function expectShips(page: Page, label: string, names: string[]) {
  await expect(shipSquares(page, label)).toHaveCount(names.length);
  for (const name of names) await expect(square(page, label, name)).toHaveClass(/\bship\b/);
}

async function start(seat: Seat, houseRules?: { salvo: boolean }) {
  const table = await seat('naval', ['Alice', 'Bob'], houseRules ? { houseRules } : {});
  const [alice, bob] = table.pages;
  return { table, alice, bob };
}

// Both fleets in place and Alice to fire, with `shots` already fired
async function firing(table: Table, shots: { 1?: Shot[]; 2?: Shot[] } = {}) {
  await table.patch({
    fleets: { 1: ALICE, 2: BOB }, phase: 'firing', started: true, currentPlayer: 1,
    shots: { 1: shots[1] ?? [], 2: shots[2] ?? [] }, lastMove: null, gameStatus: 'Both fleets are ready. Alice fires first'
  });
}

async function playing(seat: Seat, houseRules?: { salvo: boolean }) {
  const started = await start(seat, houseRules);
  await firing(started.table);
  await expect(grid(started.alice, 'Target')).toBeVisible();
  return started;
}

// Places a whole fleet with Random placement and confirms it
async function randomFleet(page: Page) {
  await button(page, 'Random placement').click();
  await expect(grid(page, 'Your fleet').locator('.ship')).toHaveCount(17);
  await button(page, 'Confirm fleet').click();
}

test.describe('Naval Battle rules', () => {
  test('ships may touch, and a fleet of one ship of each length is confirmed', async ({ seat }) => {
    const { alice } = await start(seat);
    await expect(status(alice)).toHaveText('Place your fleets');
    for (const [index, length] of [5, 4, 3, 3, 2].entries()) {
      await trayShip(alice, length).click();
      await square(alice, 'Your fleet', `${ROWS[index]}1`).click();
    }
    await expect(shipSquares(alice, 'Your fleet')).toHaveCount(17);
    await expect(square(alice, 'Your fleet', 'B4')).toHaveClass(/\bship\b/);
    await button(alice, 'Confirm fleet').click();
    await expect(status(alice)).toHaveText('Alice is ready');
    await expect(alice.getByText('Waiting for Bob')).toBeVisible();
  });

  test('Confirm fleet is offered only when every ship is placed', async ({ seat }) => {
    const { alice } = await start(seat);
    await expect(button(alice, 'Confirm fleet')).toBeDisabled();
    await trayShip(alice, 5).click();
    await square(alice, 'Your fleet', 'A1').click();
    await expect(button(alice, 'Confirm fleet')).toBeDisabled();
  });

  test('seat 1 fires first once both fleets are ready', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await randomFleet(bob);
    await expect(status(alice)).toHaveText('Bob is ready');
    await expect(alice.getByText('Waiting for Bob')).toHaveCount(0);
    await expect(bob.getByText('Waiting for Alice')).toBeVisible();
    await randomFleet(alice);
    await expect(status(bob)).toHaveText('Both fleets are ready. Alice fires first');
    await expect(alice.locator('.player-row.to-move')).toContainText('Alice');
    await expect(square(alice, 'Target', 'A1')).toBeEnabled();
    await expect(square(bob, 'Target', 'A1')).toBeDisabled();
  });

  test('a shot is answered miss or hit, and a hit gives no extra shot', async ({ seat }) => {
    const { alice, bob } = await playing(seat);
    await square(alice, 'Target', 'A1').click();
    await expect(status(bob)).toHaveText('Alice fired at A1: miss');
    await expect(square(alice, 'Target', 'A1')).toHaveClass(/\bmiss\b/);
    await expect(square(bob, 'Your fleet', 'A1')).toHaveClass(/\bmiss\b/);

    await square(bob, 'Target', 'A1').click();
    await expect(status(alice)).toHaveText('Bob fired at A1: hit');
    await expect(square(bob, 'Target', 'A1')).toHaveClass(/\bhit\b/);
    await expect(square(alice, 'Your fleet', 'A1')).toHaveClass(/\bhit\b/);
    // After the hit it is Alice's turn: Bob cannot fire again
    await expect(square(bob, 'Target', 'A2')).toBeDisabled();
    await expect(square(alice, 'Target', 'A2')).toBeEnabled();
    await expect(alice.locator('.player-row.to-move')).toContainText('Alice');
  });

  test('a shot on the last square of a ship sinks it and names its length, but not its squares', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await firing(table, { 1: [{ row: 9, col: 8, result: 'hit' }] });
    await square(alice, 'Target', 'J10').click();
    await expect(status(bob)).toHaveText('Alice fired at J10: sank a ship of length 2');
    await expect(square(alice, 'Target', 'J10')).toHaveClass(/\bsunk\b/);
    await expect(square(alice, 'Target', 'J10')).toHaveClass(/\bhit\b/);
    await expect(square(alice, 'Target', 'J9')).not.toHaveClass(/\bsunk\b/);
    await expect(shipSquares(alice, 'Target')).toHaveCount(0);
  });

  test('a square cannot be fired at twice', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await firing(table, { 1: [{ row: 0, col: 0, result: 'miss' }] });
    await square(alice, 'Target', 'A1').click();
    await expect(status(alice)).toHaveText('Both fleets are ready. Alice fires first');
    await square(alice, 'Target', 'A2').click();
    await expect(status(alice)).toHaveText('Alice fired at A2: miss');
  });

  test('with Salvo each player fires one shot per ship afloat and sees each result', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, { salvo: true });
    // Bob has sunk Alice's ship of length 2, so she has four afloat
    await firing(table, { 2: sinking([ALICE[4]]) });
    const fire = button(alice, /^Fire \(/);
    await expect(fire).toHaveText('Fire (0 of 4)');
    await expect(fire).toBeDisabled();
    for (const name of ['F1', 'A10', 'J10', 'B10']) await square(alice, 'Target', name).click();
    await square(alice, 'Target', 'B10').click(); // unmarks it
    await expect(fire).toHaveText('Fire (3 of 4)');
    await square(alice, 'Target', 'C10').click();
    await square(alice, 'Target', 'D10').click(); // a fifth mark is not taken
    await expect(fire).toHaveText('Fire (4 of 4)');
    await expect(square(alice, 'Target', 'D10')).not.toHaveClass(/selected/);
    await fire.click();
    await expect(status(bob)).toHaveText('Alice fired at F1, A10, J10 and C10: hit, miss, hit, miss');
    // Bob still has all five ships
    await expect(button(bob, /^Fire \(/)).toHaveText('Fire (0 of 5)');
  });

  test('a salvo is capped at the squares left', async ({ seat }) => {
    const { table, alice, bob } = await start(seat, { salvo: true });
    const left = ['A10', 'B10', 'C10'];
    const fired: Shot[] = [];
    for (let row = 0; row < 10; row++) for (let col = 0; col < 10; col++) {
      if (!left.includes(nameOf({ row, col }))) fired.push({ row, col, result: 'miss' });
    }
    await firing(table, { 1: fired });
    const fire = button(alice, /^Fire \(/);
    await expect(fire).toHaveText('Fire (0 of 3)');
    for (const name of left) await square(alice, 'Target', name).click();
    await fire.click();
    await expect(status(bob)).toHaveText('Alice fired at A10, B10 and C10: miss, miss, miss');
  });

  test('sinking every ship wins, and both fleets are then shown', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await firing(table, { 1: [...sinking(BOB.slice(0, 4)), { row: 9, col: 8, result: 'hit' }] });
    await expect(shipSquares(alice, 'Target')).toHaveCount(0);
    await square(alice, 'Target', 'J10').click();
    await expect(status(bob)).toHaveText('Alice sank every ship. Alice wins!');
    await seeTable(alice);
    await seeTable(bob);
    await expectShips(alice, 'Target', namesOf(BOB));
    await expectShips(bob, 'Target', namesOf(ALICE));
  });

  test('undo takes back the last turn\'s shots, but placing a fleet cannot be undone', async ({ seat }) => {
    const placing = await start(seat);
    await randomFleet(placing.alice);
    await expect(status(placing.alice)).toHaveText('Alice is ready');
    await expect(button(placing.alice, 'Undo')).toBeDisabled();

    const { alice, bob } = await playing(seat);
    await square(alice, 'Target', 'F1').click();
    await expect(status(bob)).toHaveText('Alice fired at F1: hit');
    await button(alice, 'Undo').click();
    await button(bob, 'Decline').click();
    await expect(square(alice, 'Target', 'F1')).toHaveClass(/\bhit\b/);

    await undo(alice, bob);
    await expect(square(alice, 'Target', 'F1')).not.toHaveClass(/\bhit\b/);
    await expect(square(bob, 'Your fleet', 'F1')).not.toHaveClass(/\bhit\b/);
    await expect(square(alice, 'Target', 'F1')).toBeEnabled();
    await expect(shipSquares(alice, 'Target')).toHaveCount(0);
  });

  test('a player may resign, and the other player wins', async ({ seat }) => {
    const { alice, bob } = await playing(seat);
    await square(alice, 'Target', 'A1').click();
    await expect(status(bob)).toHaveText('Alice fired at A1: miss');
    // It is Bob's turn and Alice resigns
    await button(alice, 'Resign').click();
    await button(alice, 'Confirm resign').click();
    await expect(status(bob)).toHaveText('Alice resigned. Bob wins!');
    await seeTable(bob);
    await expect(shipSquares(bob, 'Target')).toHaveCount(17);
  });

  test('resigning during placement ends the game with only the placed fleet shown', async ({ seat }) => {
    const { alice, bob } = await start(seat);
    await randomFleet(alice);
    await expect(status(bob)).toHaveText('Alice is ready');
    await button(bob, 'Resign').click();
    await button(bob, 'Confirm resign').click();
    await expect(status(alice)).toHaveText('Bob resigned. Alice wins!');
    await seeTable(alice);
    await seeTable(bob);
    await expect(shipSquares(alice, 'Your fleet')).toHaveCount(17);
    await expect(shipSquares(alice, 'Target')).toHaveCount(0);
    await expect(shipSquares(bob, 'Target')).toHaveCount(17);
    await expect(shipSquares(bob, 'Your fleet')).toHaveCount(0);
  });

  test('a draw may be offered and agreed', async ({ seat }) => {
    const { alice, bob } = await playing(seat);
    await button(alice, 'Offer draw').click();
    await expect(button(alice, 'Draw offered')).toBeDisabled();
    await button(bob, 'Accept draw').click();
    await expect(status(alice)).toHaveText('Draw by agreement');
  });

  test('a player who disconnects is waited for, and if dismissed the other player wins', async ({ seat }) => {
    const { alice, bob } = await playing(seat);
    await square(alice, 'Target', 'A1').click();
    await expect(status(alice)).toHaveText('Alice fired at A1: miss');
    await leave(bob);
    await expect(alice.getByText('Waiting for Bob to reconnect')).toBeVisible();
    await expect(alice.getByText('Game Over')).toHaveCount(0);
    await dismiss('Bob', alice);
    await expect(status(alice)).toHaveText('Alice wins! Everyone else left.');
  });
});

test.describe('Naval Battle controls', () => {
  test('a ship dragged onto the grid lands with its left end on the square under the pointer', async ({ seat }) => {
    const { alice } = await start(seat);
    await drag(alice, trayShip(alice, 5), square(alice, 'Your fleet', 'C2'));
    await expectShips(alice, 'Your fleet', ['C2', 'C3', 'C4', 'C5', 'C6']);
    await expect(alice.getByRole('button', { name: 'A ship of length 5' })).toHaveCount(0);
  });

  test('a ship dropped where it does not fit goes back to the tray', async ({ seat }) => {
    const { alice } = await start(seat);
    await drag(alice, trayShip(alice, 5), square(alice, 'Your fleet', 'A8')); // runs off the grid
    await expect(shipSquares(alice, 'Your fleet')).toHaveCount(0);
    await expect(trayShip(alice, 5)).toBeVisible();

    await drag(alice, trayShip(alice, 4), square(alice, 'Your fleet', 'B2'));
    await expect(shipSquares(alice, 'Your fleet')).toHaveCount(4);
    await drag(alice, trayShip(alice, 5), square(alice, 'Your fleet', 'B1')); // overlaps the 4
    await expect(shipSquares(alice, 'Your fleet')).toHaveCount(4);
    await expect(trayShip(alice, 5)).toBeVisible();
  });

  test('a ship is placed by tapping it and then a square, and a placed ship moves by tap', async ({ seat }) => {
    const { alice } = await start(seat);
    await trayShip(alice, 3).click();
    await expect(trayShip(alice, 3)).toHaveAttribute('aria-pressed', 'true');
    await square(alice, 'Your fleet', 'E5').click();
    await expectShips(alice, 'Your fleet', ['E5', 'E6', 'E7']);
    await expect(alice.getByRole('button', { name: 'A ship of length 3' })).toHaveCount(1);

    // Picked, its squares are marked; an empty square moves it there
    await expect(square(alice, 'Your fleet', 'E6')).toHaveClass(/selected/);
    await square(alice, 'Your fleet', 'H1').click();
    await expectShips(alice, 'Your fleet', ['H1', 'H2', 'H3']);
    // A tap on the picked ship puts it down
    await square(alice, 'Your fleet', 'H2').click();
    await expect(grid(alice, 'Your fleet').locator('.selected')).toHaveCount(0);
  });

  test('Rotate turns the tray ships, or the picked ship about its end', async ({ seat }) => {
    const { alice } = await start(seat);
    await button(alice, 'Rotate').click();
    await trayShip(alice, 4).click();
    await square(alice, 'Your fleet', 'A1').click();
    await expectShips(alice, 'Your fleet', ['A1', 'B1', 'C1', 'D1']);

    await button(alice, 'Rotate').click(); // the 4 is still picked
    await expectShips(alice, 'Your fleet', ['A1', 'A2', 'A3', 'A4']);
  });

  test('Random placement places the whole fleet, Clear takes it off, and Confirm fleet sends it', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await button(alice, 'Random placement').click();
    await expect(shipSquares(alice, 'Your fleet')).toHaveCount(17);
    await expect(alice.locator('.tray-ship')).toHaveCount(0);
    await button(alice, 'Clear').click();
    await expect(shipSquares(alice, 'Your fleet')).toHaveCount(0);
    await expect(alice.locator('.tray-ship')).toHaveCount(5);

    await randomFleet(alice);
    await expect(alice.getByText('Waiting for Bob')).toBeVisible();
    const fleet = (await table.state<{ fleets: Record<number, Ship[]> }>()).fleets[1];
    await expectShips(alice, 'Your fleet', namesOf(fleet));
    await expect(button(alice, 'Confirm fleet')).toHaveCount(0);
  });

  test('a ship can be placed by touch', async ({ seat }) => {
    const table = await seat('naval', ['Alice', 'Bob'], { touch: true });
    const [alice] = table.pages;
    // A tap on a tray ship, then a tap on a square, places it
    await trayShip(alice, 2).tap();
    await square(alice, 'Your fleet', 'J1').tap();
    await expectShips(alice, 'Your fleet', ['J1', 'J2']);

    // A finger drags a ship onto the grid, and the page does not scroll
    await alice.evaluate(() => window.scrollTo(0, 0));
    const before = await alice.evaluate(() => window.scrollY);
    await touchDrag(alice, trayShip(alice, 5), square(alice, 'Your fleet', 'B1'));
    await expectShips(alice, 'Your fleet', ['J1', 'J2', 'B1', 'B2', 'B3', 'B4', 'B5']);
    expect(await alice.evaluate(() => window.scrollY)).toBe(before);
  });

  test('without Salvo a tap on Target fires at once; Fire shows only with Salvo', async ({ seat }) => {
    const { alice, bob } = await playing(seat);
    await expect(button(alice, /^Fire \(/)).toHaveCount(0);
    await square(alice, 'Target', 'B7').click();
    await expect(status(bob)).toHaveText('Alice fired at B7: miss');
  });

  test('History opened mid-game shows the shots and no ship', async ({ seat }) => {
    const { alice, bob } = await playing(seat);
    await square(alice, 'Target', 'F1').click();
    await expect(status(bob)).toHaveText('Alice fired at F1: hit');
    await button(bob, 'History').click();
    const history = bob.getByRole('dialog', { name: 'History' });
    await expect(history).toContainText('Alice fired at F1: hit');
    // History is the table's view: no fleet before the game is over
    await expect(shipSquares(history, 'Alice')).toHaveCount(0);
    await expect(shipSquares(history, 'Bob')).toHaveCount(0);
    await expect(square(history, 'Bob', 'F1')).toHaveClass(/\bhit\b/);
    await expect(square(history, 'Bob', 'F1')).toHaveClass(/selected/);
  });

  test('a spectator and a table screen see no ship', async ({ seat, browser, server }) => {
    const { table, alice } = await playing(seat);
    await square(alice, 'Target', 'F1').click();
    await expect(status(alice)).toHaveText('Alice fired at F1: hit');
    const dana = await watch(browser, server, 'naval', table.gameId, 'Dana');
    const tv = await tableScreen(table);
    for (const page of [dana, tv]) {
      await expect(page.locator('.naval-grid')).toHaveCount(2);
      await expect(page.locator('.naval-grid .hit')).toHaveCount(1);
      await expect(page.locator('.naval-grid .ship')).toHaveCount(0);
    }
    await dana.context().close();
    await tv.context().close();
  });

  test('the other fleet never reaches a browser before the game ends', async ({ seat, browser, server }) => {
    const table = await seat('naval', ['Alice']);
    const [alice] = table.pages;
    const bob = await newPlayer(browser, server);
    const frames: string[] = [];
    bob.on('websocket', ws => ws.on('framereceived', frame => { frames.push(String(frame.payload)); }));
    await joinGame(bob, 'naval', table.gameId, 'Bob');
    for (const page of [alice, bob]) await inHouseRules(page, dialog => expect(dialog.locator('.house-rules-list li')).toHaveCount(2));
    await agreeToHouseRules(alice, bob);

    await randomFleet(alice);
    await expect(status(bob)).toHaveText('Alice is ready');
    await randomFleet(bob);
    await expect(status(alice)).toHaveText('Both fleets are ready. Alice fires first');
    await square(alice, 'Target', 'A1').click();
    await expect(status(bob)).toHaveText(/^Alice fired at A1: /);
    await square(bob, 'Target', 'A1').click();
    await expect(status(alice)).toHaveText(/^Bob fired at A1: /);
    await square(alice, 'Target', 'A2').click();
    await expect(status(bob)).toHaveText(/^Alice fired at A2: /);

    const fleets = (await table.state<{ fleets: Record<number, Ship[]> }>()).fleets;
    const found: unknown[] = [];
    const walk = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') {
        if ('orientation' in value || ('length' in value && 'row' in value)) found.push(value);
        Object.values(value).forEach(walk);
      }
    };
    for (const frame of frames) {
      try { walk(JSON.parse(frame)); } catch { /* not JSON */ }
    }
    expect(found.length).toBeGreaterThan(0); // Bob's own fleet came through
    for (const ship of found) expect(fleets[2].some(own => isDeepStrictEqual(own, ship)), JSON.stringify(ship)).toBe(true);
    await bob.context().close();
  });

  test('FAQ at the top of the page shows the rules and controls', async ({ seat }) => {
    const { alice } = await start(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('one ship of each length: 5, 4, 3, 3 and 2');
    await expect(faq).toContainText('Random placement');
    await expect(faq).toContainText('Salvo');
  });
});
