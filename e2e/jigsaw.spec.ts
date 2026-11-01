import type { Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';
import {
  agreeToHouseRules, dismiss, drag, expect, joinGame, leave, lift, newPlayer, openFaq, setHouseRules, test, touchDrag, undo,
  type Seat, type Table
} from './fixtures.ts';
import { gridOf, homeOf, type PieceCount } from '../games/jigsaw/cut.ts';
import type { Board, GameState, Piece } from '../games/jigsaw/types.ts';

// One test per rule, control and difference in games/jigsaw/README.md. Seat 1 is Alice, the host; seat 2 is Bob.
// The scatter is random, so a test first lays the table out: the pieces it drags lie apart beside the board (SLOTS)
// and every other piece is stacked in the bottom right corner, out of the way.

// Beside the board (which runs from x 280 to 1720 and y 80 to 1040), clear of each other's tabs
const SLOTS = [100, 340, 580, 820].flatMap(y => [{ x: 40, y }, { x: 1780, y }]);

const loose = (x: number, y: number): Piece => ({ x, y, placed: false, heldBy: null, placedBy: null });

// `free` pieces lie in SLOTS in order, `placed` pieces are locked in their spots, the rest are stacked out of the way
function layout(count: PieceCount, free: number[], placed: number[] = []): Board {
  const grid = gridOf(count);
  return {
    pieces: Array.from({ length: count }, (_, piece) => {
      if (placed.includes(piece)) return { ...homeOf(grid, piece), placed: true, heldBy: null, placedBy: null };
      const slot = free.indexOf(piece);
      return slot >= 0 ? loose(SLOTS[slot].x, SLOTS[slot].y) : loose(2000 - grid.w, 1800 - grid.h);
    })
  };
}

// Every piece but `free` placed
const allBut = (count: PieceCount, ...free: number[]) =>
  layout(count, free, Array.from({ length: count }, (_, piece) => piece).filter(piece => !free.includes(piece)));

const piece = (page: Page, n: number) => page.locator(`.jigsaw-main [data-piece="${n}"]`);
const spot = (page: Page, n: number) => page.locator(`.jigsaw-main [data-spot="${n}"]`);
const status = (page: Page) => page.locator('.jigsaw-side .game-status');
const placedCount = (page: Page) => page.locator('.jigsaw-count');
const preview = (page: Page) => page.locator('.jigsaw-preview');
const picker = (page: Page) => page.getByRole('group', { name: 'Choose a picture' });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });
const standing = (page: Page, name: string) => gameOver(page).locator('.game-over-standings li', { hasText: name });

// Waits until every open page shows the laid out table
async function lay(table: Table, fields: Partial<GameState>): Promise<void> {
  await table.patch(fields);
  for (const page of table.pages) if (!page.isClosed()) await expect(page.locator('.jigsaw-main [data-piece]').first()).toBeVisible();
}

// `page` drags piece `n` onto its own spot and sees it lock there
async function place(page: Page, n: number): Promise<void> {
  await drag(page, piece(page, n), spot(page, n));
  await expect(piece(page, n)).not.toHaveAttribute('data-drag');
}

async function solo(seat: Seat, count: PieceCount = 48) {
  const table = await seat('jigsaw', ['Alice'], count === 48 ? {} : { houseRules: { pieces: count } });
  return { table, alice: table.pages[0] };
}

async function together(seat: Seat) {
  const table = await seat('jigsaw', ['Alice', 'Bob']);
  return { table, alice: table.pages[0], bob: table.pages[1] };
}

// Race needs two seats before it is offered, so the host picks it once Bob is in and both agree
async function race(table: Table) {
  const [alice, bob] = table.pages;
  await setHouseRules(alice, 'jigsaw', { mode: 'race' });
  await agreeToHouseRules(alice, bob);
}

// Every WebSocket frame `page` receives from now on, as text
function recordFrames(page: Page): string[] {
  const frames: string[] = [];
  page.on('websocket', ws => ws.on('framereceived', ({ payload }) => frames.push(typeof payload === 'string' ? payload : payload.toString('utf8'))));
  return frames;
}

// Whether any `boards` object anywhere in `value` has a key `seat`
function holdsBoard(value: unknown, seat: string): boolean {
  if (Array.isArray(value)) return value.some(item => holdsBoard(item, seat));
  if (value === null || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, inner]) =>
    (key === 'boards' && inner !== null && typeof inner === 'object' && seat in inner) || holdsBoard(inner, seat));
}

function crc32(bytes: Buffer): number {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// A width x height RGB PNG: a left to right red to blue gradient
function png(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB, no interlace
  const row = Buffer.alloc(1 + width * 3); // filter byte 0, then the pixels
  for (let x = 0; x < width; x++) row.set([Math.round((255 * (width - x)) / width), 80, Math.round((255 * x) / width)], 1 + x * 3);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))
  ]);
}

test.describe('Jigsaw rules', () => {
  test('Solo: a piece dragged to its spot snaps and locks', async ({ seat }) => {
    const { table, alice } = await solo(seat);
    await lay(table, { board: layout(48, [0]) });
    await expect(piece(alice, 0)).toHaveAttribute('data-drag', '');
    await place(alice, 0);
    await expect(placedCount(alice)).toHaveText('1 of 48 placed');
    const { board } = await table.state<GameState>();
    expect(board.pieces[0]).toEqual({ ...homeOf(gridOf(48), 0), placed: true, heldBy: null, placedBy: 1 });
    // A locked piece cannot be picked up again
    await drag(alice, piece(alice, 0), spot(alice, 20));
    expect((await table.state<GameState>()).board.pieces[0].placed).toBe(true);
  });

  test('a piece dropped away from its spot stays loose where it was let go', async ({ seat }) => {
    const { table, alice } = await solo(seat);
    await lay(table, { board: layout(48, [0]) });
    await drag(alice, piece(alice, 0), spot(alice, 47));
    await expect(placedCount(alice)).toHaveText('0 of 48 placed');
    const grid = gridOf(48);
    const home = homeOf(grid, 47);
    await expect.poll(async () => {
      const dropped = (await table.state<GameState>()).board.pieces[0];
      return !dropped.placed && Math.abs(dropped.x - home.x) < grid.w / 2 && Math.abs(dropped.y - home.y) < grid.h / 2;
    }).toBe(true);
    await expect(piece(alice, 0)).toHaveAttribute('data-drag', '');
  });

  test('a piece locks only into its own spot, and pieces never rotate', async ({ seat }) => {
    const { table, alice } = await solo(seat);
    await lay(table, { board: layout(48, [1, 0]) });
    await drag(alice, piece(alice, 1), spot(alice, 0)); // piece 1 on piece 0's spot
    await expect(piece(alice, 1)).toHaveAttribute('data-drag', '');
    await expect(placedCount(alice)).toHaveText('0 of 48 placed');
    await place(alice, 0); // piece 0 lands under the loose piece 1 and still locks
    await expect(placedCount(alice)).toHaveText('1 of 48 placed');
    for (const transform of await alice.locator('.jigsaw-main [data-piece]').evaluateAll(pieces => pieces.map(each => each.getAttribute('transform')))) {
      expect(transform).toMatch(/^translate\([-\d.]+,[-\d.]+\)$/);
    }
  });

  test('the last piece finishes the puzzle', async ({ seat }) => {
    const { table, alice } = await solo(seat);
    await lay(table, { board: allBut(48, 5) });
    await expect(placedCount(alice)).toHaveText('47 of 48 placed');
    await drag(alice, piece(alice, 5), spot(alice, 5));
    await expect(gameOver(alice)).toBeVisible();
    await expect(status(alice)).toHaveText('The puzzle is done!');
    await expect(standing(alice, 'Alice')).toContainText('48 pieces');
    const state = await table.state<GameState>();
    expect(state.isGameOver).toBe(true);
    expect(state.winners).toEqual([1]);
  });

  test('the pieces house rule gives 24, 96 or 150 pieces', async ({ seat }) => {
    const standard = await solo(seat);
    await expect(standard.alice.locator('.jigsaw-main [data-piece]')).toHaveCount(48);
    await expect(placedCount(standard.alice)).toHaveText('0 of 48 placed');
    for (const count of [24, 96, 150] as const) {
      const { alice } = await solo(seat, count);
      await expect(alice.locator('.jigsaw-main [data-piece]')).toHaveCount(count);
      await expect(alice.locator('.jigsaw-main [data-spot]')).toHaveCount(count);
      await expect(placedCount(alice)).toHaveText(`0 of ${count} placed`);
    }
  });

  test('the host picks a built-in picture and everyone sees it', async ({ seat }) => {
    const { table, alice, bob } = await together(seat);
    await expect(preview(bob)).toHaveAttribute('src', '/api/svg/jigsaw-picture/mountains');
    await button(alice, 'Beach').click();
    await expect(button(alice, 'Beach')).toHaveAttribute('aria-pressed', 'true');
    await expect(button(alice, 'Mountain lake')).toHaveAttribute('aria-pressed', 'false');
    await expect(preview(bob)).toHaveAttribute('src', '/api/svg/jigsaw-picture/beach');
    await expect(bob.locator('.jigsaw-main [data-piece="0"] image')).toHaveAttribute('href', '/api/svg/jigsaw-picture/beach');
    expect((await table.state<GameState>()).picture).toEqual({ kind: 'builtin', name: 'beach' });
  });

  test('a non-host sees the preview but no picker', async ({ seat }) => {
    const { alice, bob } = await together(seat);
    await expect(picker(alice)).toBeVisible();
    await expect(preview(bob)).toBeVisible();
    await expect(picker(bob)).toHaveCount(0);
    await expect(bob.getByLabel('Upload a photo')).toHaveCount(0);
    await expect(bob.getByText('Alice picks the picture')).toBeVisible();
  });

  test('an uploaded photo becomes the picture without riding in state broadcasts', async ({ seat, browser, server }) => {
    const table = await seat('jigsaw', ['Alice']);
    const [alice] = table.pages;
    const bob = await newPlayer(browser, server);
    const frames = recordFrames(bob);
    try {
      await joinGame(bob, 'jigsaw', table.gameId, 'Bob');
      await alice.getByLabel('Upload a photo').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png(300, 200) });
      await expect(preview(bob)).toHaveAttribute('src', /^\/api\/images\/[0-9a-f]{32}$/);
      const { picture } = await table.state<GameState>();
      expect(picture).toEqual({ kind: 'photo', id: expect.stringMatching(/^[0-9a-f]{32}$/) });
      const url = `/api/images/${picture.kind === 'photo' ? picture.id : ''}`;
      await expect(preview(alice)).toHaveAttribute('src', url);
      await expect(bob.locator('.jigsaw-main [data-piece="0"] pattern image')).toHaveAttribute('href', url);
      // The photo is served once by its id
      expect(await bob.evaluate(async src => (await fetch(src)).headers.get('content-type'), url)).toMatch(/^image\//);

      await agreeToHouseRules(alice, bob);
      await table.patch({ board: layout(48, [0]) });
      await place(alice, 0);
      await expect(placedCount(bob)).toHaveText('1 of 48 placed');
      expect(frames.length).toBeGreaterThan(0);
      for (const frame of frames) {
        expect(Buffer.byteLength(frame)).toBeLessThan(64 * 1024);
        expect(frame).not.toContain('data:image');
      }
    } finally {
      await bob.context().close();
    }
  });

  test('the picture survives a player joining and locks on the first pick-up', async ({ seat }) => {
    const table = await seat('jigsaw', ['Alice']);
    const [alice] = table.pages;
    await button(alice, 'Fox in the woods').click();
    await expect(preview(alice)).toHaveAttribute('src', '/api/svg/jigsaw-picture/fox');
    const bob = await table.join('Bob');
    await expect(preview(bob)).toHaveAttribute('src', '/api/svg/jigsaw-picture/fox');
    await expect(button(alice, 'Fox in the woods')).toHaveAttribute('aria-pressed', 'true');

    await lay(table, { board: layout(48, [0]) });
    await lift(alice, piece(alice, 0));
    // Play has started: the picker holds its place until the drag ends, but nothing in it can be picked
    await expect(button(alice, 'Beach')).toBeDisabled();
    await expect(alice.getByLabel('Upload a photo')).toBeDisabled();
    await alice.mouse.up();
    await expect(picker(alice)).toHaveCount(0);
    await expect(bob.getByText('Alice picks the picture')).toHaveCount(0);
    expect((await table.state<GameState>()).picture).toEqual({ kind: 'builtin', name: 'fox' });
  });

  test('Together: a held piece shows as held and cannot be taken', async ({ seat }) => {
    const { table, alice, bob } = await together(seat);
    await lay(table, { board: layout(48, [0]) });
    await lift(alice, piece(alice, 0));
    await expect(piece(bob, 0)).toHaveAttribute('data-held-by', '1');
    await expect(piece(bob, 0)).not.toHaveAttribute('data-drag');
    await expect(piece(bob, 0).locator('.jigsaw-holder')).toHaveText('Alice');
    await drag(bob, piece(bob, 0), spot(bob, 0)); // does nothing
    let { board } = await table.state<GameState>();
    expect(board.pieces[0]).toMatchObject({ placed: false, heldBy: 1 });

    await alice.mouse.up(); // Alice lets go just beside where she lifted it
    await expect(piece(bob, 0)).not.toHaveAttribute('data-held-by');
    await expect(piece(bob, 0)).toHaveAttribute('data-drag', '');
    await place(bob, 0);
    ({ board } = await table.state<GameState>());
    expect(board.pieces[0]).toMatchObject({ placed: true, placedBy: 2 });
    await expect(piece(alice, 0)).not.toHaveAttribute('data-drag');
  });

  test('Together: both players place pieces at once and the end shows each count', async ({ seat }) => {
    const { table, alice, bob } = await together(seat);
    await lay(table, { board: allBut(48, 0, 1, 2) });
    await Promise.all([place(alice, 0), place(bob, 1)]);
    await expect(placedCount(alice)).toHaveText('47 of 48 placed');
    await expect(alice.locator('.jigsaw-players li', { hasText: 'Bob' })).toHaveText('Bob 1');
    await place(alice, 2);
    await expect(status(bob)).toHaveText('The puzzle is done!');
    await expect(standing(bob, 'Alice')).toContainText('2 placed');
    await expect(standing(bob, 'Bob')).toContainText('1 placed');
    await expect(gameOver(bob).locator('.standing-place')).toHaveText(['1st', '1st']);
    expect((await table.state<GameState>()).winners).toEqual([1, 2]);
  });

  test('Race: you see your own board and the others only as a percentage', async ({ seat, browser, server }) => {
    const table = await seat('jigsaw', ['Alice']);
    const [alice] = table.pages;
    const bob = await newPlayer(browser, server);
    const frames = recordFrames(bob);
    try {
      await joinGame(bob, 'jigsaw', table.gameId, 'Bob');
      await race({ ...table, pages: [alice, bob] });
      await table.patch({ boards: { 1: layout(48, [0]), 2: layout(48, [0]) } });
      await expect(piece(bob, 0)).toHaveAttribute('data-drag', '');
      await place(alice, 0);
      await expect(placedCount(alice)).toHaveText('1 of 48 placed');
      await expect(bob.locator('.jigsaw-players li', { hasText: 'Alice' })).toHaveText('Alice 2%');
      await expect(bob.locator('.jigsaw-players li', { hasText: 'Bob' })).toHaveText('Bob 0%');
      // Bob's table is his own: Alice's placed piece is loose on it
      await expect(placedCount(bob)).toHaveText('0 of 48 placed');
      await expect(piece(bob, 0)).toHaveAttribute('data-drag', '');
      await expect(bob.locator('.jigsaw-main [data-piece]:not([data-drag])')).toHaveCount(0);
      expect(frames.length).toBeGreaterThan(0);
      for (const frame of frames) expect(holdsBoard(JSON.parse(frame), '1'), frame.slice(0, 200)).toBe(false);
    } finally {
      await bob.context().close();
    }
  });

  test('Race: the first to finish wins', async ({ seat }) => {
    const table = await seat('jigsaw', ['Alice', 'Bob']);
    const [alice, bob] = table.pages;
    await race(table);
    await table.patch({ boards: { 1: allBut(48, 0), 2: allBut(48, 0, 1) } });
    await expect(placedCount(bob)).toHaveText('46 of 48 placed');
    await place(bob, 0);
    await expect(alice.locator('.jigsaw-players li', { hasText: 'Bob' })).toHaveText('Bob 98%');
    await drag(alice, piece(alice, 0), spot(alice, 0));
    await expect(status(bob)).toHaveText('Alice finished first!');
    await expect(standing(bob, 'Alice')).toContainText('1st');
    await expect(standing(bob, 'Bob')).toContainText('2nd');
    await expect(standing(bob, 'Bob')).toContainText('98%');
    expect((await table.state<GameState>()).winners).toEqual([1]);
  });

  test('Undo my last move takes back only your own snap', async ({ seat }) => {
    const { table, alice, bob } = await together(seat);
    await lay(table, { board: layout(48, [0, 1]) });
    await place(alice, 0);
    await place(bob, 1);
    await expect(placedCount(alice)).toHaveText('2 of 48 placed');
    await expect(button(alice, 'Undo')).toHaveCount(0); // no vote in Together
    await button(alice, 'Undo my last move').click();
    await expect(piece(bob, 0)).toHaveAttribute('data-drag', '');
    await expect(piece(bob, 1)).not.toHaveAttribute('data-drag');
    await expect(placedCount(bob)).toHaveText('1 of 48 placed');
    await expect(button(alice, 'Undo my last move')).toBeDisabled(); // Alice has nothing left to take back
    await expect(button(bob, 'Undo my last move')).toBeEnabled();
    const { board } = await table.state<GameState>();
    const grid = gridOf(48);
    const home = homeOf(grid, 0);
    expect(board.pieces[0]).toEqual(loose(home.x + grid.w / 2, home.y + grid.h / 2)); // just beside its spot
  });

  test('Solo undo applies at once', async ({ seat }) => {
    const { table, alice } = await solo(seat);
    await lay(table, { board: layout(48, [0, 1]) });
    await place(alice, 0);
    await drag(alice, piece(alice, 1), spot(alice, 47)); // a loose move after the snap
    await expect.poll(async () => (await table.state<GameState>()).board.pieces[1].x).not.toBe(SLOTS[1].x);
    await undo(alice); // nobody else to ask
    await expect(piece(alice, 0)).toHaveAttribute('data-drag', '');
    await expect(placedCount(alice)).toHaveText('0 of 48 placed');
    const { board } = await table.state<GameState>();
    // Back to just before the snap: piece 0 where it was lifted, and piece 1's later move undone with it
    expect(board.pieces[0]).toEqual(loose(SLOTS[0].x, SLOTS[0].y));
    expect(board.pieces[1]).toEqual(loose(SLOTS[1].x, SLOTS[1].y));
  });

  test('the game goes on when one player is left', async ({ seat }) => {
    const { table, alice, bob } = await together(seat);
    await lay(table, { board: layout(48, [0, 1]) });
    await place(bob, 1);
    await leave(bob);
    await expect(alice.getByText('Bob disconnected')).toBeVisible();
    await dismiss('Bob', alice);
    await expect(alice.locator('.jigsaw-players li', { hasText: 'Bob' })).toHaveCount(0);
    await expect(gameOver(alice)).toHaveCount(0);
    await table.patch({ board: allBut(48, 0) });
    await place(alice, 0);
    await expect(status(alice)).toHaveText('The puzzle is done!');
    expect((await table.state<GameState>()).winners).toEqual([1]);
  });
});

test.describe('Jigsaw controls', () => {
  test('dragging with a finger', async ({ seat }) => {
    const table = await seat('jigsaw', ['Alice'], { touch: true });
    const [alice] = table.pages;
    await lay(table, { board: layout(48, [0]) });
    await piece(alice, 0).scrollIntoViewIfNeeded();
    await touchDrag(alice, piece(alice, 0), spot(alice, 0));
    await expect(piece(alice, 0)).not.toHaveAttribute('data-drag');
    await expect(placedCount(alice)).toHaveText('1 of 48 placed');
  });

  test('zoom makes 150 pieces grabbable on a phone', async ({ seat }) => {
    const table = await seat('jigsaw', ['Alice'], { touch: true, houseRules: { pieces: 150 } });
    const [alice] = table.pages;
    await lay(table, { board: layout(150, [0]) });
    const width = async () => (await piece(alice, 0).boundingBox())!.width;
    expect(await width()).toBeLessThan(44);
    await button(alice, 'Zoom in').click();
    await button(alice, 'Zoom in').click();
    await expect(button(alice, 'Zoom in')).toBeDisabled();
    expect(await width()).toBeGreaterThanOrEqual(44);
    await piece(alice, 0).scrollIntoViewIfNeeded();
    await touchDrag(alice, piece(alice, 0), spot(alice, 0));
    await expect(placedCount(alice)).toHaveText('1 of 150 placed');
    await button(alice, 'Zoom out').click();
    await button(alice, 'Zoom out').click();
    await expect(button(alice, 'Zoom out')).toBeDisabled();
    expect(await width()).toBeLessThan(44);
  });

  test('Show picture guide draws the picture on the board', async ({ seat }) => {
    const { alice } = await solo(seat);
    await expect(alice.locator('.jigsaw-guide')).toHaveCount(0);
    await alice.getByLabel('Show picture guide').check();
    await expect(alice.locator('.jigsaw-guide')).toHaveAttribute('href', '/api/svg/jigsaw-picture/mountains');
  });

  test('History lists each placed piece', async ({ seat }) => {
    const { table, alice } = await solo(seat);
    await lay(table, { board: layout(48, [0, 1]) });
    await place(alice, 0);
    await place(alice, 1);
    await expect(placedCount(alice)).toHaveText('2 of 48 placed');
    await alice.getByRole('button', { name: 'History' }).click();
    const history = alice.getByRole('dialog', { name: 'History' });
    await expect(history.locator('.history-move')).toContainText('Alice placed a piece (2 of 48)');
    await expect(history.locator('.jigsaw-piece.highlighted')).toHaveAttribute('data-piece', '1');
    await history.getByRole('slider', { name: 'Step' }).fill('1');
    await expect(history.locator('.history-move')).toContainText('Alice placed a piece (1 of 48)');
    await expect(history.locator('.jigsaw-piece.highlighted')).toHaveAttribute('data-piece', '0');
  });

  test('the FAQ opens from Rules', async ({ seat }) => {
    const { alice } = await solo(seat);
    const faq = await openFaq(alice);
    await expect(faq).toContainText('How do I pick the picture?');
    await expect(faq).toContainText('What are Solo, Together and Race?');
    await faq.getByRole('button', { name: 'Close' }).click();
    await expect(faq).toHaveCount(0);
  });
});
