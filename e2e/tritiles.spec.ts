import type { Locator, Page } from '@playwright/test';
import { dismiss, expect, headerButton, leave, openFaq, test, undo, type Seat, type Table } from './fixtures.ts';
import { cellKey, openPlacements } from '../games/tritiles/grid.ts';
import type { Board, Cell } from '../games/tritiles/grid.ts';
import { TILES, tileSum } from '../games/tritiles/tiles.ts';
import type { GameState } from '../games/tritiles/types.ts';
import type { HouseRuleValues } from '../shared/houseRules.ts';

// One test per rule and control in games/tritiles/README.md. Players are seated in join order: Alice is seat 1,
// Bob seat 2, Cara seat 3. A tile is written as its three numbers in rising order, as the hand labels it.

type Numbers = [number, number, number];
const id = (...n: Numbers) => TILES.findIndex(tile => tile.join() === [...n].sort((a, b) => a - b).join());
const ids = (...tiles: Numbers[]) => tiles.map(n => id(...n));
const nameOf = (tile: number) => TILES[tile].join('-');
const cell = (x: number, y: number, up: boolean): Cell => ({ x, y, up });
const ORIGIN = cell(0, 0, true);
// The opening tile alone on the board
const opened = (...n: Numbers): Board => [{ tile: id(...n), cell: ORIGIN, corners: TILES[id(...n)] as Numbers }];

// Lays a tile on each cell of `path` in turn, each the first unused tile that fits there, until some unused tile also fits `last`:
// a legal board for any shape of play. Returns the board and that last tile
function lay(path: Cell[], last: Cell, board: Board = []): { board: Board; tile: number } | null {
  const used = new Set(board.map(p => p.tile));
  const free = TILES.map((_, tile) => tile).filter(tile => !used.has(tile));
  if (path.length === 0) {
    const tile = free.find(t => openPlacements(board, t).some(p => cellKey(p.cell) === cellKey(last)));
    return tile === undefined ? null : { board, tile };
  }
  for (const tile of free) for (const { cell: at, corners } of openPlacements(board, tile)) {
    if (cellKey(at) !== cellKey(path[0])) continue;
    const found = lay(path.slice(1), last, [...board, { tile, cell: at, corners }]);
    if (found) return found;
  }
  return null;
}

// Five tiles around the point (0, 0); the sixth, on (-1, 0) down, completes the hexagon
const HEXAGON = lay([ORIGIN, cell(0, 0, false), cell(0, -1, true), cell(-1, -1, false), cell(-1, -1, true)], cell(-1, 0, false))!;
const HEXAGON_SPACE = cell(-1, 0, false);
// A path that numbers the point (1, 0) without touching (0, 0) down along an edge: a tile there completes a bridge
const BRIDGE = lay([ORIGIN, cell(0, 1, false), cell(1, 1, true), cell(1, 1, false), cell(2, 1, true), cell(2, 1, false), cell(2, 0, true), cell(1, 0, false)], cell(0, 0, false))!;
const BRIDGE_SPACE = cell(0, 0, false);

type Deal = {
  hands: Record<number, number[]>;
  pool?: number[]; // the top tile is the last one; by default one tile, so a round is not blocked at once
  board?: Board;
  current?: number;
  scores?: Record<number, number>;
  leadTile?: number | null;
  drawsThisTurn?: number;
};

// Crafts a round under way
async function deal(table: Table, { hands, pool = [id(2, 4, 4)], board = opened(5, 5, 5), current = 1, scores, leadTile = null, drawsThisTurn = 0 }: Deal) {
  const seats = Object.keys(hands).map(Number);
  await table.patch({
    started: true,
    roundNumber: 1,
    hands,
    pool,
    board,
    drawsThisTurn,
    leadTile,
    roundSummary: null,
    lastMove: null,
    currentPlayer: current,
    scores: scores ?? Object.fromEntries(seats.map(seat => [seat, 0]))
  });
}

async function start(seat: Seat, names = ['Alice', 'Bob'], houseRules?: HouseRuleValues) {
  const table = await seat('tritiles', names, houseRules ? { houseRules } : {});
  return { table, pages: table.pages };
}

const hand = (page: Page) => page.getByRole('region', { name: 'Your hand' });
const handTile = (page: Page, tile: number) => hand(page).getByRole('button', { name: nameOf(tile), exact: true });
const spaces = (page: Page) => page.locator('.tri-space');
const space = (page: Page, at: Cell) => page.locator(`.tri-space[data-drop="${cellKey(at)}"]`);
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const status = (page: Page) => page.locator('.game-status');
const turn = (page: Page) => page.locator('.turn-message');
const hint = (page: Page) => page.locator('.hint');
const score = (page: Page, name: string) => page.locator('.players .player', { hasText: name }).locator('.player-score');
const count = (page: Page, name: string) => page.locator('.players .player', { hasText: name }).locator('.player-count');
const pool = (page: Page) => page.locator('.pool');
const scoring = (page: Page) => page.getByRole('dialog', { name: 'Round scoring' });
const gameOver = (page: Page) => page.getByRole('dialog', { name: 'Game over' });
const choice = (page: Page) => page.getByRole('group', { name: 'Place the tile' });
const distinctSpaces = (board: Board, tile: number) => new Set(openPlacements(board, tile).map(p => cellKey(p.cell))).size;
const rotationsAt = (board: Board, tile: number, at: Cell) => openPlacements(board, tile).filter(p => cellKey(p.cell) === cellKey(at));

// Picks up `tile` and plays it on `at`, confirming when that space takes it more than one way
async function place(page: Page, board: Board, tile: number, at: Cell) {
  await handTile(page, tile).click();
  await space(page, at).click();
  if (rotationsAt(board, tile, at).length > 1) await button(page, 'Confirm').click();
}

test.describe('Tri-Tiles rules', () => {
  test('56 tiles, 9 each with two players and 7 with three, the rest in the pool', async ({ seat }) => {
    for (const [names, size] of [[['Alice', 'Bob'], 9], [['Alice', 'Bob', 'Cara'], 7]] as const) {
      const { table, pages } = await start(seat, [...names]);
      const state = await table.state<GameState>();
      const all = [...Object.values(state.hands).flat(), ...state.pool];
      expect(new Set(all).size).toBe(56);
      await expect(hand(pages[0]).getByRole('button')).toHaveCount(size);
      await expect(count(pages[0], 'Bob')).toHaveText(`${size} tiles`);
      await expect(pool(pages[1])).toHaveText(`Pool: ${56 - names.length * size}`);
    }
  });

  test('the highest triple opens and scores its sum plus 10; only it can be played', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, { hands: { 1: ids([4, 4, 4], [5, 5, 4]), 2: ids([3, 3, 3]) }, board: [], leadTile: id(4, 4, 4) });
    await expect(handTile(alice, id(5, 5, 4))).toBeDisabled();
    await expect(hint(alice)).toHaveText('Open the round with your highest triple, or your highest-sum tile');
    await handTile(alice, id(4, 4, 4)).click();
    await expect(spaces(alice)).toHaveCount(1);
    await spaces(alice).click();
    await expect(status(bob)).toHaveText('Alice played 4-4-4 for 22 (triple)');
    await expect(score(bob, 'Alice')).toHaveText('22 pts');
  });

  test('without a triple, the highest sum opens and scores its sum only, after Rotate and Confirm', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, { hands: { 1: ids([3, 4, 5], [0, 1, 2]), 2: ids([0, 1, 3]) }, board: [], leadTile: id(3, 4, 5) });
    await handTile(alice, id(3, 4, 5)).click();
    await spaces(alice).click();
    // The space takes 3-4-5 three ways: the first is shown, and Rotate turns it to the next
    await expect(choice(alice)).toBeVisible();
    await expect(hint(alice)).toHaveText('That space takes the tile more than one way: Rotate, then Confirm');
    await button(alice, 'Rotate').click();
    await button(alice, 'Confirm').click();
    await expect(status(bob)).toHaveText('Alice played 3-4-5 for 12');
    const { board } = await table.state<GameState>();
    expect(board[0].corners).toEqual(openPlacements([], id(3, 4, 5))[1].corners);
  });

  test('a tile must match every corner it touches; it scores its sum', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    const board = opened(1, 2, 3);
    // 1-1-2 matches an edge of 1-2-3 (clockwise 1, 1, 2 against its 1 and 2); 1-2-4 holds the same numbers but reads the wrong way round
    expect(openPlacements(board, id(1, 2, 4))).toEqual([]);
    await deal(table, { hands: { 1: ids([1, 1, 2], [1, 2, 4]), 2: ids([0, 0, 5]) }, pool: ids([0, 0, 0]), board });
    await expect(handTile(alice, id(1, 2, 4))).toBeDisabled();
    await handTile(alice, id(1, 1, 2)).click();
    await expect(spaces(alice)).toHaveCount(distinctSpaces(board, id(1, 1, 2)));
    const [first] = openPlacements(board, id(1, 1, 2));
    await space(alice, first.cell).click();
    if (rotationsAt(board, id(1, 1, 2), first.cell).length > 1) await button(alice, 'Confirm').click();
    await expect(status(bob)).toHaveText('Alice played 1-1-2 for 4');
    await expect(score(bob, 'Alice')).toHaveText('4 pts');
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('completing a hexagon scores 50 more and shows in the log', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    const spare = TILES.findIndex((_, tile) => tile !== HEXAGON.tile && !HEXAGON.board.some(p => p.tile === tile) && tileSum(tile) > 12);
    await deal(table, { hands: { 1: [HEXAGON.tile, spare], 2: [id(5, 5, 5)] }, board: HEXAGON.board });
    await place(alice, HEXAGON.board, HEXAGON.tile, HEXAGON_SPACE);
    const points = tileSum(HEXAGON.tile) + 50;
    await expect(status(bob)).toHaveText(`Alice played ${nameOf(HEXAGON.tile)} for ${points} (hexagon)`);
    await expect(score(bob, 'Alice')).toHaveText(`${points} pts`);
    await (await headerButton(bob, 'History')).click();
    await expect(bob.getByRole('dialog', { name: 'History' })).toContainText(`(hexagon)`);
  });

  test('completing a bridge scores 40 more', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, { hands: { 1: [BRIDGE.tile, id(5, 5, 5)], 2: [id(4, 4, 4)] }, board: BRIDGE.board });
    await place(alice, BRIDGE.board, BRIDGE.tile, BRIDGE_SPACE);
    await expect(status(bob)).toHaveText(`Alice played ${nameOf(BRIDGE.tile)} for ${tileSum(BRIDGE.tile) + 40} (bridge)`);
  });

  test('the host can turn off the bonuses and choose the target', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat, ['Alice', 'Bob'], { hexagon: false, bridge: false, targetScore: 200 });
    await expect(alice.locator('.round')).toHaveText('Round 1: first to 200 points wins');
    await deal(table, { hands: { 1: [HEXAGON.tile, id(5, 5, 5)], 2: [id(4, 4, 4)] }, board: HEXAGON.board });
    await place(alice, HEXAGON.board, HEXAGON.tile, HEXAGON_SPACE);
    await expect(status(bob)).toHaveText(`Alice played ${nameOf(HEXAGON.tile)} for ${tileSum(HEXAGON.tile)}`);
  });

  test('draw only when nothing fits, 5 points each and at most 3 a turn; then pass for 10 more', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, {
      hands: { 1: ids([0, 1, 2], [1, 1, 1]), 2: ids([4, 5, 5]) },
      pool: ids([2, 2, 2], [0, 0, 1], [0, 0, 2], [0, 0, 3])
    });
    await expect(button(bob, 'Draw')).toBeDisabled();
    await expect(button(alice, 'Pass')).toBeDisabled();
    await expect(hint(alice)).toHaveText('Nothing fits: draw from the pool, 5 points a tile, up to 3');
    await button(alice, 'Draw').click();
    await expect(status(bob)).toHaveText('Alice drew a tile (-5)');
    await expect(hint(alice)).toHaveText('Nothing fits: draw again (1 of 3 drawn)');
    await button(alice, 'Draw').click();
    await expect(hint(alice)).toHaveText('Nothing fits: draw again (2 of 3 drawn)');
    await button(alice, 'Draw').click();
    await expect(hand(alice).getByRole('button')).toHaveCount(5);
    await expect(pool(bob)).toHaveText('Pool: 1');
    await expect(button(alice, 'Draw')).toBeDisabled();
    await expect(hint(alice)).toHaveText('Nothing fits after 3 draws: pass for 10 points');
    await button(alice, 'Pass').click();
    await expect(status(bob)).toHaveText('Alice passed (-10)');
    await expect(score(bob, 'Alice')).toHaveText('-25 pts');
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('a drawn tile that fits may be played at once', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, { hands: { 1: ids([0, 1, 2]), 2: ids([0, 0, 0]) }, pool: ids([1, 1, 1], [4, 5, 5]) });
    await button(alice, 'Draw').click();
    await expect(handTile(alice, id(4, 5, 5))).toBeEnabled();
    await expect(button(alice, 'Draw')).toBeDisabled();
    await expect(turn(alice)).toHaveText('Your turn');
    await place(alice, opened(5, 5, 5), id(4, 5, 5), openPlacements(opened(5, 5, 5), id(4, 5, 5))[0].cell);
    await expect(status(bob)).toHaveText('Alice played 4-5-5 for 14');
    await expect(score(bob, 'Alice')).toHaveText('9 pts');
  });

  test('an undo of a draw puts the tile back and keeps the same tiles in the pool', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, { hands: { 1: ids([0, 1, 2]), 2: ids([0, 0, 0]) }, pool: ids([1, 1, 1], [0, 0, 3]) });
    await button(alice, 'Draw').click();
    await expect(hand(alice).getByRole('button')).toHaveCount(2);
    await undo(alice, bob);
    await expect(hand(alice).getByRole('button')).toHaveCount(1);
    await expect(pool(alice)).toHaveText('Pool: 2');
    await expect(score(alice, 'Alice')).toHaveText('0 pts');
    const { pool: left } = await table.state<GameState>();
    expect([...left].sort((a, b) => a - b)).toEqual(ids([1, 1, 1], [0, 0, 3]).sort((a, b) => a - b));
  });

  test('with the pool empty and nothing playable, pass for 10', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, { hands: { 1: ids([0, 1, 2]), 2: ids([4, 5, 5], [0, 0, 0]) }, pool: [] });
    await expect(button(alice, 'Draw')).toBeDisabled();
    await expect(hint(alice)).toHaveText('Nothing fits and the pool is empty: pass for 10 points');
    await button(alice, 'Pass').click();
    await expect(score(bob, 'Alice')).toHaveText('-10 pts');
    await expect(turn(bob)).toHaveText('Your turn');
  });

  test('going out scores 25 plus the other hands; Continue deals the next round', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, { hands: { 1: ids([4, 5, 5]), 2: ids([0, 1, 2], [3, 3, 3]) }, pool: ids([0, 0, 0]) });
    await place(alice, opened(5, 5, 5), id(4, 5, 5), openPlacements(opened(5, 5, 5), id(4, 5, 5))[0].cell);
    const dialog = scoring(bob);
    // 14 for the tile, then 25 + 3 + 9
    await expect(dialog.locator('.summary-result')).toHaveText('Alice went out and scores 37 points');
    await expect(dialog.locator('.summary-seat', { hasText: 'Alice' })).toContainText('51 pts');
    await expect(dialog.locator('.summary-seat', { hasText: 'Bob' })).toContainText('left holding 12 points');
    await expect(turn(bob)).toHaveText('Round 1 is over');
    await scoring(alice).getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(alice).locator('.summary-waiting')).toHaveText('Waiting for Bob');
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await expect(scoring(bob)).toHaveCount(0);
    await expect(bob.locator('.round')).toHaveText('Round 2: first to 400 points wins');
    await expect(hand(bob).getByRole('button')).toHaveCount(9);
    await expect(score(bob, 'Alice')).toHaveText('51 pts');
  });

  test('a blocked round goes to the lowest hand, by the difference to each other hand; a tie scores nothing', async ({ seat }) => {
    const first = await start(seat);
    await deal(first.table, { hands: { 1: ids([0, 0, 1]), 2: ids([1, 2, 3]) }, pool: [], current: 2 });
    await button(first.pages[1], 'Pass').click();
    // Bob passes for -10; Alice's 1 is the lowest, 6 - 1 = 5
    await expect(scoring(first.pages[0]).locator('.summary-result')).toHaveText('Alice has the lowest total in a blocked round and scores 5 points');

    const tied = await start(seat);
    await deal(tied.table, { hands: { 1: ids([0, 1, 2]), 2: ids([0, 0, 3]) }, pool: [], current: 2 });
    await button(tied.pages[1], 'Pass').click();
    await expect(scoring(tied.pages[0]).locator('.summary-result')).toHaveText('The round is blocked and tied: nobody scores');
    await expect(score(tied.pages[0], 'Alice')).toHaveText('0 pts');
  });

  test('the game ends when a round ends with someone at the target, and the highest total wins', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, { hands: { 1: ids([4, 5, 5]), 2: ids([0, 1, 2]) }, scores: { 1: 300, 2: 395 } });
    await place(alice, opened(5, 5, 5), id(4, 5, 5), openPlacements(opened(5, 5, 5), id(4, 5, 5))[0].cell);
    // Alice 300 + 14 + 25 + 3 = 342 has not reached 400, Bob is below too
    await expect(scoring(bob)).toBeVisible();

    const final = await start(seat, ['Dan', 'Eve']);
    await deal(final.table, { hands: { 1: ids([4, 5, 5]), 2: ids([0, 1, 2]) }, scores: { 1: 390, 2: 395 } });
    await place(final.pages[0], opened(5, 5, 5), id(4, 5, 5), openPlacements(opened(5, 5, 5), id(4, 5, 5))[0].cell);
    const over = gameOver(final.pages[1]);
    await expect(over.getByRole('heading', { level: 2 })).toHaveText('Dan wins');
    await expect(over.getByRole('heading', { name: 'Round 1 scoring' })).toBeVisible();
    await expect(over.locator('.summary-seat', { hasText: 'Dan' }).locator('.summary-points')).toHaveText('432 pts');
    await expect(turn(final.pages[1])).toHaveText('Game over: Dan wins');
  });

  test('you see only your own tiles, the others\' counts and the pool count', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, { hands: { 1: ids([4, 5, 5], [0, 1, 2]), 2: ids([3, 3, 3]) }, pool: ids([1, 1, 1]) });
    await expect(count(bob, 'Alice')).toHaveText('2 tiles');
    await expect(bob.locator('[title="4-5-5"]')).toHaveCount(0);
    await expect(alice.locator('[title="3-3-3"]')).toHaveCount(0);
    await expect(alice.locator('[title="1-1-1"]')).toHaveCount(0);
    await expect(pool(alice)).toHaveText('Pool: 1');
  });

  test('a dismissed player\'s tiles return to the pool and play moves on', async ({ seat }) => {
    const { table, pages: [alice, bob, cara] } = await start(seat, ['Alice', 'Bob', 'Cara']);
    await deal(table, { hands: { 1: ids([0, 1, 2]), 2: ids([3, 3, 3], [2, 2, 2]), 3: ids([4, 5, 5], [1, 1, 1]) }, pool: ids([0, 0, 0]), current: 2 });
    await leave(bob);
    await dismiss('Bob', alice, cara);
    await expect(alice.locator('.players .player')).toHaveCount(2);
    await expect(pool(cara)).toHaveText('Pool: 3');
    await expect(turn(cara)).toHaveText('Your turn');
    await expect(handTile(cara, id(4, 5, 5))).toBeEnabled();
  });

  test('History shows the move with the tile outlined, and the FAQ explains the rules', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, { hands: { 1: ids([4, 5, 5], [0, 1, 2]), 2: ids([3, 3, 3]) } });
    await place(alice, opened(5, 5, 5), id(4, 5, 5), openPlacements(opened(5, 5, 5), id(4, 5, 5))[0].cell);
    await (await headerButton(bob, 'History')).click();
    const history = bob.getByRole('dialog', { name: 'History' });
    await expect(history).toContainText('Alice played 4-5-5 for 14');
    await expect(history.locator('.tri-last')).toHaveCount(1);
    await bob.keyboard.press('Escape');
    const faq = await openFaq(bob);
    await expect(faq).toContainText('Rotate turns it to the next way that fits');
  });
});

test.describe('Tri-Tiles controls', () => {
  // The middle of an element, scrolled into view first: the mouse does not scroll
  async function centre(locator: Locator) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) throw new Error('nothing there');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  const ghost = (page: Page) => page.locator('.drag-ghost');

  test('a tile dragged onto a lit space is played there, and the spaces light up while it is held', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    const board = opened(5, 5, 5);
    await deal(table, { hands: { 1: ids([4, 5, 5], [0, 1, 2]), 2: ids([3, 3, 3]) }, board });
    const from = await centre(handTile(alice, id(4, 5, 5)));
    await alice.mouse.move(from.x, from.y);
    await alice.mouse.down();
    await alice.mouse.move(from.x + 20, from.y - 20, { steps: 4 });
    await expect(ghost(alice)).toHaveCount(1);
    await expect(spaces(alice)).toHaveCount(distinctSpaces(board, id(4, 5, 5)));
    const to = await centre(spaces(alice).first());
    await alice.mouse.move(to.x, to.y, { steps: 8 });
    await alice.mouse.up();
    await expect(status(bob)).toHaveText('Alice played 4-5-5 for 14');
  });

  test('a tile dropped away from the lit spaces goes back and nothing is sent; tapping it again puts it back', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    await deal(table, { hands: { 1: ids([4, 5, 5], [0, 1, 2]), 2: ids([3, 3, 3]) } });
    const before = JSON.stringify(await table.state<GameState>());
    const from = await centre(handTile(alice, id(4, 5, 5)));
    const to = await centre(alice.locator('.players'));
    await alice.mouse.move(from.x, from.y);
    await alice.mouse.down();
    await alice.mouse.move(to.x, to.y, { steps: 8 });
    await alice.mouse.up();
    await expect(ghost(alice)).toHaveCount(0);
    await expect(spaces(alice)).toHaveCount(0);
    expect(JSON.stringify(await table.state<GameState>())).toBe(before);

    await handTile(alice, id(4, 5, 5)).click();
    await expect(spaces(alice)).not.toHaveCount(0);
    await handTile(alice, id(4, 5, 5)).click();
    await expect(spaces(alice)).toHaveCount(0);
  });

  test('Cancel puts back a tile waiting for Rotate and Confirm; off turn, nothing lifts', async ({ seat }) => {
    const { table, pages: [alice, bob] } = await start(seat);
    await deal(table, { hands: { 1: ids([3, 4, 5]), 2: ids([0, 1, 2]) }, board: [], leadTile: id(3, 4, 5) });
    await handTile(alice, id(3, 4, 5)).click();
    await spaces(alice).click();
    await button(alice, 'Cancel').click();
    await expect(choice(alice)).toHaveCount(0);
    await expect(spaces(alice)).toHaveCount(0);
    await expect(handTile(bob, id(0, 1, 2))).toBeDisabled();
    await expect(handTile(bob, id(0, 1, 2))).not.toHaveAttribute('data-drag');
  });

  test('zoom keeps the middle of the board in view, and a phone has no sideways page scroll', async ({ seat }) => {
    const { table, pages: [alice] } = await start(seat);
    await alice.setViewportSize({ width: 320, height: 700 });
    await deal(table, { hands: { 1: [BRIDGE.tile], 2: ids([5, 5, 5]) }, board: BRIDGE.board });
    const scroller = alice.locator('.board-scroll');
    const middle = () => scroller.evaluate(box => {
      const svg = box.querySelector('svg')!;
      return { x: (box.scrollLeft + box.clientWidth / 2) / svg.clientWidth, y: (box.scrollTop + box.clientHeight / 2) / svg.clientHeight };
    });
    // From 1x to 1.5x the board outgrows the box; from 1.5x to 2x the middle stays put
    await button(alice, 'Zoom in').click();
    const zoomed = await middle();
    await button(alice, 'Zoom in').click();
    await expect(button(alice, 'Zoom in')).toBeDisabled();
    const more = await middle();
    expect(Math.abs(more.x - zoomed.x)).toBeLessThan(0.02);
    expect(await alice.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await button(alice, 'Zoom out').click();
    await expect(button(alice, 'Zoom in')).toBeEnabled();
  });
});
