import type { Page } from '@playwright/test';
import { expect, leave, test, type Seat, type Table } from './fixtures.ts';
import type { GameState } from '../games/jenga/types.ts';

// One test per rule and control in games/jenga/README.md, driven by the keyboard and buttons only, so they pass without WebGL.
// The server only moves the tower when told: table.simulate(n) runs n physics ticks. Seat 1 (Alice) pulls first.

// Lets headless Chrome draw the tower through its software renderer
test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });

const status = (page: Page) => page.locator('.jenga-status');
const tower = (page: Page) => page.getByRole('application', { name: 'Tower' });
const place = (page: Page, slot: string) => page.getByRole('button', { name: `Place on top, ${slot}` });

async function start(seat: Seat) {
  const table = await seat('jenga', ['Alice', 'Bob']);
  const [alice, bob] = table.pages;
  return { table, alice, bob };
}

const state = (table: Table) => table.state<GameState>();

// Selects block 49, the middle of level 17 (the highest a block may come from), and grabs it
async function grabMiddle(table: Table, page: Page) {
  await tower(page).focus();
  await tower(page).press('ArrowDown');
  await tower(page).press('ArrowRight');
  await expect(page.locator('.jenga-selection')).toHaveText(/Level 17, middle block/);
  await tower(page).press('Enter');
  await expect.poll(async () => (await state(table)).grab?.block).toBe(49);
}

// Each press steers the grab; the ticks between let the block follow
async function pressAndTick(table: Table, page: Page, key: string, times: number) {
  for (let press = 0; press < times; press++) {
    await tower(page).press(key);
    await table.simulate(5);
  }
}

async function settle(table: Table) {
  for (let round = 0; round < 20 && (await state(table)).sim !== null; round++) await table.simulate(20);
  expect((await state(table)).sim).toBeNull();
}

test.describe('Jenga rules', () => {
  test('the tower has 54 blocks and Alice pulls first', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await expect(status(alice)).toHaveText('Your turn: pull a block from the tower');
    await expect(status(bob)).toHaveText("Alice's turn to pull a block");
    expect((await state(table)).blocks).toHaveLength(54);
  });

  test('a pull by keyboard takes a block out and placing it on top passes the turn', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await grabMiddle(table, alice);
    for (let press = 0; press < 80 && (await state(table)).held === null; press++) await pressAndTick(table, alice, 'ArrowDown', 1);
    expect((await state(table)).held).toBe(49);
    await expect(status(alice)).toHaveText('Your turn: place your block on top');
    await expect(place(bob, 'middle')).toHaveCount(0);
    await settle(table);
    await place(alice, 'middle').click();
    await expect(status(bob)).toHaveText('Your turn: pull a block from the tower');
    await expect(status(alice)).toHaveText("Bob's turn to pull a block");
    await alice.getByRole('button', { name: 'History' }).click();
    await expect(alice.getByRole('dialog', { name: 'History' })).toContainText('Move 1 of 1: Alice pulled a block from level 17 and placed it on top');
  });

  test('with Free placement, Place on top sets the block down and the physics finishes the turn', async ({ seat }) => {
    const table = await seat('jenga', ['Alice', 'Bob'], { houseRules: { freePlacement: true } });
    const [alice, bob] = table.pages;
    await grabMiddle(table, alice);
    for (let press = 0; press < 80 && (await state(table)).held === null; press++) await pressAndTick(table, alice, 'ArrowDown', 1);
    expect((await state(table)).held).toBe(49);
    await settle(table);
    await place(alice, 'middle').click();
    await expect.poll(async () => (await state(table)).dropping).toBe(49);
    await settle(table);
    await expect(status(bob)).toHaveText('Your turn: pull a block from the tower');
    await alice.getByRole('button', { name: 'History' }).click();
    await expect(alice.getByRole('dialog', { name: 'History' })).toContainText('Move 1 of 1: Alice pulled a block from level 17 and dropped it on top');
  });

  test('History starts from the untouched tower', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await grabMiddle(table, alice);
    for (let press = 0; press < 80 && (await state(table)).held === null; press++) await pressAndTick(table, alice, 'ArrowDown', 1);
    await settle(table);
    await place(alice, 'middle').click();
    await expect(status(alice)).toHaveText("Bob's turn to pull a block");
    await alice.getByRole('button', { name: 'History' }).click();
    const dialog = alice.getByRole('dialog', { name: 'History' });
    const drawn = dialog.locator('.jenga-history [data-block-count]');
    await dialog.getByRole('slider', { name: 'Step' }).fill('0');
    await expect(drawn).toHaveAttribute('data-block-count', '54');
    await dialog.getByRole('slider', { name: 'Step' }).fill('1');
    await expect(drawn).toHaveAttribute('data-block-count', '54');
  });

  test('no block grip reaches either player over the socket during a grab, pull and place', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    expect((await state(table)).grip).toHaveLength(54);
    const frames: string[] = [];
    // The sockets opened during the join, before page.on('websocket') could see them, so Chrome's own network events are read
    for (const page of [alice, bob]) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Network.enable');
      cdp.on('Network.webSocketFrameReceived', event => frames.push(event.response.payloadData));
    }
    await grabMiddle(table, alice);
    for (let press = 0; press < 80 && (await state(table)).held === null; press++) await pressAndTick(table, alice, 'ArrowDown', 1);
    await settle(table);
    await place(alice, 'middle').click();
    await expect(status(bob)).toHaveText('Your turn: pull a block from the tower');
    expect(frames.filter(frame => frame.includes('"blocks"')).length).toBeGreaterThan(10);
    expect(frames.filter(frame => frame.includes('grip'))).toEqual([]);
  });

  test('a block can be slid back and another chosen', async ({ seat }) => {
    const { table, alice } = await start(seat);
    await grabMiddle(table, alice);
    await pressAndTick(table, alice, 'ArrowDown', 2);
    await pressAndTick(table, alice, 'ArrowUp', 2);
    await tower(alice).press('Escape');
    await expect.poll(async () => (await state(table)).grab).toBeNull();
    await tower(alice).press('ArrowLeft');
    await tower(alice).press('Enter');
    await expect.poll(async () => (await state(table)).grab?.block).toBe(48);
    expect((await state(table)).pull?.block).toBe(48);
  });

  test('toppling the tower ends the game, names the loser and lets everyone else win', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    const { blocks } = await state(table);
    // Without the middle and one side of level 2, the tower falls over
    await table.patch({ started: true, blocks: blocks.filter(b => b.id !== 4 && b.id !== 5), sim: { ticks: 0, calmTicks: 0, sinceRelease: 0 } });
    await table.simulate(150);
    await expect(status(alice)).toHaveText('Alice toppled the tower!');
    await expect(status(bob)).toHaveText('Alice toppled the tower!');
    const end = await state(table);
    expect(end.isGameOver).toBe(true);
    expect(end.winners).toEqual([2]);
  });

  test('the game-over screen waits for the fallen tower to stop', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    const { blocks } = await state(table);
    await table.patch({ started: true, blocks: blocks.filter(b => b.id !== 4 && b.id !== 5), sim: { ticks: 0, calmTicks: 0, sinceRelease: 0 } });
    await table.simulate(5);
    await expect(status(alice)).toHaveText('Alice toppled the tower!');
    for (const page of [alice, bob]) await expect(page.getByRole('dialog', { name: 'Game over' })).toHaveCount(0);
    await settle(table);
    for (const page of [alice, bob]) await expect(page.getByRole('dialog', { name: 'Game over' })).toBeVisible();
  });

  test('a pull in progress settles when the puller leaves', async ({ seat }) => {
    const { table, alice, bob } = await start(seat);
    await grabMiddle(table, alice);
    await leave(alice);
    await expect.poll(async () => (await state(table)).grab).toBeNull();
    await table.simulate(220);
    const after = await state(table);
    expect(after.sim).toBeNull();
    expect(after.currentPlayer).toBe(1);
    await expect(bob.getByText('Waiting for Alice to reconnect')).toBeVisible();
  });

  test('the Rules dialog shows the Jenga rules', async ({ seat }) => {
    const { alice } = await start(seat);
    await alice.locator('.game-header').getByRole('button', { name: 'Rules', exact: true }).click();
    const rules = alice.getByRole('dialog', { name: / rules$/ });
    await expect(rules).toContainText('grip');
    await expect(rules).toContainText('topple');
    await rules.getByRole('button', { name: 'FAQ', exact: true }).click();
    await expect(rules.locator('.faq')).toContainText('What counts as toppling the tower?');
    await rules.getByRole('button', { name: 'Close' }).click();
    await expect(rules).toHaveCount(0);
  });
});
