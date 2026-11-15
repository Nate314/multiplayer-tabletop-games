import type { Page } from '@playwright/test';
import { dismiss, drag, expect, headerButton, leave, openFaq, openHouseRules, setHouseRules, test, touchDrag, watch, type Seat, type SeatOptions, type Table } from './fixtures.ts';
import type { Layout } from '../games/shaperace/board.ts';
import type { GameState } from '../games/shaperace/types.ts';

// One test per rule and control in games/shaperace/README.md. Seat 1 is Alice, 2 Bob.
// A table starts with 9 shapes, every shape turned so it fits (turns 0), so a test drags straight to the hole.

const SIZE = 9;
const status = (page: Page) => page.locator('.game-status');
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });
const board = (page: Page) => page.getByRole('img', { name: 'Your board' });
const shape = (page: Page, n: number) => page.getByRole('list', { name: 'Shapes' }).locator('li').nth(n).getByRole('button');
const bar = (page: Page, text: string) => page.getByRole('list', { name: 'Progress' }).getByText(text, { exact: true });

// Every seat's tray turned so each shape fits its hole
async function upright(table: Table) {
  const { boards } = await table.state<GameState>();
  return Object.fromEntries(Object.entries(boards).map(([seat, own]) => [seat, { ...own, turns: own!.turns.map(() => 0) }]));
}

// The race starts on the last Agree, which turns the house rules read-only, so the platform helper's wait for the
// agreed row cannot see it: click Agree on every page and wait for the clock instead
async function agreeAll(...pages: Page[]) {
  for (const page of pages) {
    await openHouseRules(page);
    await page.getByRole('button', { name: 'Agree', exact: true }).click();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
  }
  for (const page of pages) await expect(page.getByRole('timer')).toBeVisible();
}

async function start(seat: Seat, names = ['Alice', 'Bob'], options: SeatOptions = {}) {
  const { raceEnd, ...houseRules } = options.houseRules ?? {};
  const table = await seat('shaperace', names, { ...options, agree: false, houseRules: { shapes: SIZE, ...houseRules } });
  if (!options.agree && options.agree !== undefined) return table;
  if (raceEnd) await setHouseRules(table.pages[0], 'shaperace', { raceEnd });
  await agreeAll(...table.pages);
  await table.patch({ boards: await upright(table) });
  return table;
}

const holeOf = (layout: Layout, n: number) => layout.holes.indexOf(layout.tray[n]);
const layoutOf = async (table: Table) => (await table.state<GameState>()).layout!;
const placedOf = async (table: Table, seat = 1) => (await table.state<GameState>()).boards[seat]!.placed;

// The pixel position of `hole` within the board, after the tray shape is in view
async function inHole(page: Page, n: number, hole: number) {
  await shape(page, n).scrollIntoViewIfNeeded();
  const box = (await board(page).boundingBox())!;
  const side = Math.sqrt(SIZE);
  return { x: ((hole % side) + 0.5) * box.width / side, y: (Math.floor(hole / side) + 0.5) * box.height / side };
}

// Drags tray shape `n` onto `hole` of the player's board
async function dropOn(page: Page, n: number, hole: number) {
  await drag(page, shape(page, n), board(page), await inHole(page, n, hole));
}

// Fills every hole but tray shape `last`'s for `seats` straight in the state, so one drag finishes the board
async function nearlyFull(table: Table, last: number, ...seats: number[]) {
  const { layout, boards } = await table.state<GameState>();
  const placed = Object.fromEntries(layout!.tray.map((_, n) => [holeOf(layout!, n), n]).filter(([, n]) => n !== last));
  const filled = Object.fromEntries(seats.map(seat => [seat, { ...boards[seat], placed, turns: boards[seat]!.turns.map(() => 0) }]));
  await table.patch({ boards: { ...boards, ...filled } });
}

test.describe('Shape Race rules', () => {
  test('the race waits until everyone has agreed to the house rules', async ({ seat }) => {
    const [alice] = (await start(seat, ['Alice', 'Bob'], { agree: false })).pages;
    await expect(alice.getByText('The clock starts once everyone agrees to the house rules')).toBeVisible();
    await expect(alice.getByRole('timer')).toHaveCount(0);
  });

  test('the house rules offer the board size and the timer, and the race end only with company', async ({ seat }) => {
    const [alone] = (await start(seat, ['Alice'], { agree: false })).pages;
    const solo = await openHouseRules(alone);
    await expect(solo.getByLabel('Board size', { exact: true })).toBeVisible();
    await expect(solo.getByLabel('Timer', { exact: true })).toBeVisible();
    await expect(solo.getByLabel('Race end', { exact: true })).toHaveCount(0);
    const [together] = (await start(seat, ['Cara', 'Dan'], { agree: false })).pages;
    await expect(await openHouseRules(together)).toContainText('Race end');
  });

  test('a fitting drag places the shape in its hole', async ({ seat }) => {
    const table = await start(seat, ['Alice']);
    const [alice] = table.pages;
    const layout = await layoutOf(table);
    await expect(shape(alice, 0)).toBeVisible();
    await dropOn(alice, 0, holeOf(layout, 0));
    await expect(shape(alice, 0)).toHaveCount(0);
    await expect.poll(() => placedOf(table)).toEqual({ [holeOf(layout, 0)]: 0 });
  });

  test('a wrong drop springs back and sends nothing', async ({ seat }) => {
    const table = await start(seat, ['Alice']);
    const [alice] = table.pages;
    const layout = await layoutOf(table);
    await dropOn(alice, 0, layout.holes.findIndex(id => id !== layout.tray[0]));
    await expect(shape(alice, 0)).toBeVisible();
    await expect(shape(alice, 0)).not.toHaveClass(/sr-dragging/);
    await expect(alice.locator('.game-status-error')).toHaveCount(0);
    expect(await placedOf(table)).toEqual({});
  });

  test('a release off the board springs back and sends nothing', async ({ seat }) => {
    const table = await start(seat, ['Alice']);
    const [alice] = table.pages;
    await shape(alice, 0).scrollIntoViewIfNeeded();
    const from = (await shape(alice, 0).boundingBox())!;
    await alice.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await alice.mouse.down();
    await alice.mouse.move(2, from.y + from.height / 2, { steps: 8 });
    await alice.mouse.up();
    await expect(shape(alice, 0)).toBeVisible();
    await expect(shape(alice, 0)).not.toHaveClass(/sr-dragging/);
    expect(await placedOf(table)).toEqual({});
  });

  test('a finger drags a shape in too', async ({ seat }) => {
    const table = await start(seat, ['Alice'], { touch: true });
    const [alice] = table.pages;
    const layout = await layoutOf(table);
    const centered = layout.tray.findIndex((_, n) => holeOf(layout, n) === 4); // touchDrag aims at the board's center
    await shape(alice, centered).scrollIntoViewIfNeeded();
    await touchDrag(alice, shape(alice, centered), board(alice));
    await expect.poll(() => placedOf(table)).toEqual({ 4: centered });
  });

  test('a tap turns a shape one eighth of a turn', async ({ seat }) => {
    const [alice] = (await start(seat, ['Alice'])).pages;
    await expect(shape(alice, 0)).toHaveAccessibleName(/turned 0 degrees$/);
    await shape(alice, 0).click();
    await expect(shape(alice, 0)).toHaveAccessibleName(/turned 45 degrees$/);
  });

  test('a shape that is not turned to fit springs back until it is', async ({ seat }) => {
    const table = await start(seat, ['Alice']);
    const [alice] = table.pages;
    const layout = await layoutOf(table);
    const turning = layout.tray.findIndex(id => id !== 'circle' && id !== 'octagon'); // a round shape fits at any turn
    await shape(alice, turning).click();
    await dropOn(alice, turning, holeOf(layout, turning));
    await expect(shape(alice, turning)).toBeVisible();
    expect(await placedOf(table)).toEqual({});
  });

  test('a tap that ends before the page renders does not block the next drag', async ({ seat }) => {
    const table = await start(seat, ['Alice']);
    const [alice] = table.pages;
    const layout = await layoutOf(table);
    // Press and release in one task, as a fast tap from a scripted or loaded browser can
    await shape(alice, 1).evaluate(button => {
      for (const type of ['pointerdown', 'pointerup']) {
        button.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 9, button: 0, clientX: 1, clientY: 1 }));
      }
    });
    await dropOn(alice, 0, holeOf(layout, 0));
    await expect.poll(() => placedOf(table)).toEqual({ [holeOf(layout, 0)]: 0 });
  });

  test('others see only your count during the race', async ({ seat }) => {
    const table = await start(seat);
    const [alice, bob] = table.pages;
    await expect(bar(bob, 'Alice 0/9')).toBeVisible();
    await dropOn(alice, 0, holeOf(await layoutOf(table), 0));
    await expect(bar(bob, 'Alice 1/9')).toBeVisible();
    await expect(bob.getByRole('img', { name: /board/ })).toHaveCount(1); // only Bob's own board
  });

  test('the first to fill their board wins and the others keep racing', async ({ seat }) => {
    const table = await start(seat);
    const [alice, bob] = table.pages;
    const layout = await layoutOf(table);
    await nearlyFull(table, 0, 1);
    await dropOn(alice, 0, holeOf(layout, 0));
    await expect(alice.getByText(/You filled the board in \d+:\d\d\.\d/)).toBeVisible();
    await expect(bar(bob, 'Alice 9/9 ✓')).toBeVisible();
    await expect(gameOver(bob)).toHaveCount(0);
    await nearlyFull(table, 0, 2);
    await dropOn(bob, 0, holeOf(layout, 0));
    for (const page of [alice, bob]) await expect(gameOver(page)).toContainText('Alice wins');
  });

  test('First finish ends the race the moment someone fills their board', async ({ seat }) => {
    const table = await start(seat, ['Alice', 'Bob'], { houseRules: { raceEnd: 'first' } });
    const [alice, bob] = table.pages;
    await nearlyFull(table, 0, 1);
    await dropOn(alice, 0, holeOf(await layoutOf(table), 0));
    for (const page of [alice, bob]) await expect(gameOver(page)).toContainText('Alice wins');
  });

  test('the board pops at the end of the timer and the most shapes placed wins', async ({ seat }) => {
    const table = await start(seat, ['Alice', 'Bob'], { houseRules: { seconds: 30 } });
    const [alice, bob] = table.pages;
    await dropOn(alice, 0, holeOf(await layoutOf(table), 0));
    await expect(bar(bob, 'Alice 1/9')).toBeVisible();
    await table.patch({ raceStartedAt: Date.now() - 29_000 });
    for (const page of [alice, bob]) await expect(status(page)).toHaveText('The board popped! Alice placed the most');
  });

  test('a pop where nobody placed anything is shared by everyone', async ({ seat }) => {
    const table = await start(seat, ['Alice', 'Bob'], { houseRules: { seconds: 30 } });
    await table.patch({ raceStartedAt: Date.now() - 29_000 });
    for (const page of table.pages) await expect(status(page)).toHaveText('The board popped! Nobody placed a shape');
    expect((await table.state<GameState>()).winners).toEqual([1, 2]);
  });

  test('solo: you win by filling the board before the pop', async ({ seat }) => {
    const table = await start(seat, ['Alice']);
    const [alice] = table.pages;
    await nearlyFull(table, 0, 1);
    await dropOn(alice, 0, holeOf(await layoutOf(table), 0));
    await expect(gameOver(alice)).toContainText('Alice wins');
    expect((await table.state<GameState>()).winners).toEqual([1]);
  });

  test('solo: a pop with the board unfilled wins nothing', async ({ seat }) => {
    const table = await start(seat, ['Alice'], { houseRules: { seconds: 30 } });
    await table.patch({ raceStartedAt: Date.now() - 29_000 });
    await expect(gameOver(table.pages[0])).toBeVisible();
    expect((await table.state<GameState>()).winners).toEqual([]);
  });

  test('a pause keeps the race\'s remaining time', async ({ seat }) => {
    const table = await start(seat);
    const [alice, bob] = table.pages;
    const before = (await table.state<GameState>()).raceStartedAt!;
    await (await headerButton(alice, 'Pause')).click();
    await bob.getByRole('button', { name: 'Approve' }).click();
    for (const page of [alice, bob]) await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
    await alice.waitForTimeout(1500);
    await bob.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(alice.getByRole('timer')).toBeVisible();
    await expect.poll(async () => (await table.state<GameState>()).raceStartedAt! - before).toBeGreaterThanOrEqual(1400);
  });

  test('a player leaving after the others finished ends the race at once', async ({ seat }) => {
    const table = await start(seat);
    const [alice, bob] = table.pages;
    await nearlyFull(table, 0, 1);
    await dropOn(alice, 0, holeOf(await layoutOf(table), 0));
    await expect(bar(bob, 'Alice 9/9 ✓')).toBeVisible();
    await leave(bob);
    await dismiss('Bob', alice);
    await expect(gameOver(alice)).toContainText('Alice wins');
  });

  test('a spectator sees every board', async ({ seat, browser, server }) => {
    const table = await start(seat);
    const [alice] = table.pages;
    await dropOn(alice, 0, holeOf(await layoutOf(table), 0));
    const spectator = await watch(browser, server, 'shaperace', table.gameId, 'Cara');
    await expect(spectator.getByRole('img', { name: "Alice's board" })).toBeVisible();
    await expect(spectator.getByRole('img', { name: "Bob's board" })).toBeVisible();
    await expect(spectator.getByText('Alice 1/9', { exact: true })).toBeVisible();
  });

  test('Rematch on the game over dialog starts a new race', async ({ seat }) => {
    const table = await start(seat, ['Alice']);
    const [alice] = table.pages;
    await table.patch({ raceStartedAt: Date.now() - 61_000 });
    await expect(gameOver(alice)).toBeVisible();
    await gameOver(alice).getByRole('button', { name: 'Rematch' }).click();
    await agreeAll(alice);
    await expect(alice.getByRole('timer')).toBeVisible();
    await expect(shape(alice, 0)).toBeEnabled();
    expect(await placedOf(table)).toEqual({});
  });

  test('there is no undo', async ({ seat }) => {
    const [alice] = (await start(seat, ['Alice'])).pages;
    await expect(alice.getByRole('button', { name: /undo/i })).toHaveCount(0);
  });

  test('the FAQ opens from Rules', async ({ seat }) => {
    const [alice] = (await start(seat, ['Alice'])).pages;
    await expect(await openFaq(alice)).toContainText('How do I turn a shape?');
  });
});
