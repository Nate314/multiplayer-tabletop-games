import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seeded } from '../testStates.ts';
import { PICTURE_W, PICTURE_H } from './pictures.ts';
import {
  GRIDS, TABLE_W, TABLE_H, BOARD_X, BOARD_Y, gridOf, homeOf, edgesOf, piecePath, snaps, clampToTable, scatter,
  type Grid, type PieceCount, type Point,
} from './cut.ts';

const COUNTS: PieceCount[] = [24, 48, 96, 150];

test('every grid divides the picture into whole cells', () => {
  for (const count of COUNTS) {
    const grid = gridOf(count);
    assert.equal(grid.cols * grid.rows, count);
    assert.equal(grid.cols, GRIDS[count].cols);
    assert.ok(Number.isInteger(grid.w) && Number.isInteger(grid.h));
    assert.equal(grid.w * grid.cols, PICTURE_W);
    assert.equal(grid.h * grid.rows, PICTURE_H);
  }
});

test('the same seed cuts the same way', () => {
  const grid = gridOf(96);
  assert.deepEqual(edgesOf(5, grid), edgesOf(5, grid));
});

test('different seeds cut differently', () => {
  const grid = gridOf(96);
  assert.notDeepEqual(edgesOf(5, grid), edgesOf(6, grid));
});

test('outer sides are flat and inner sides match their neighbor', () => {
  const grid = { cols: 6, rows: 4, w: 100, h: 100 };
  const edges = edgesOf(1, grid);
  assert.equal(edges.right.length, 4);
  assert.ok(edges.right.every((row) => row.length === 5));
  assert.equal(edges.down.length, 3);
  assert.ok(edges.down.every((row) => row.length === 6));
  for (const value of [...edges.right.flat(), ...edges.down.flat()]) assert.ok(value === 1 || value === -1);
  const path = piecePath(grid, edges, 0);
  assert.ok(path.startsWith('M 0 0 L 100 0'), 'flat top goes straight to the corner');
  assert.ok(path.endsWith('L 0 100 L 0 0 Z'), 'flat left goes straight to the corner');
  assert.ok(path.includes('C'), 'inner sides have curves');
  // piece 1 (right of piece 0) draws the shared edge with the opposite sign
  const flipped = { ...edges, right: edges.right.map((row, r) => (r === 0 ? row.map((v, c) => (c === 0 ? -v : v)) : row)) };
  assert.notEqual(piecePath(grid, flipped, 0), piecePath(grid, edges, 0));
  assert.notEqual(piecePath(grid, flipped, 1), piecePath(grid, edges, 1));
});

test('a drop near home snaps and a far one does not', () => {
  const grid = gridOf(48);
  const min = Math.min(grid.w, grid.h);
  const home = homeOf(grid, 9);
  assert.deepEqual(home, { x: BOARD_X + grid.w, y: BOARD_Y + grid.h });
  assert.ok(snaps(grid, 9, home.x + 0.29 * min, home.y));
  assert.ok(!snaps(grid, 9, home.x + 0.31 * min, home.y));
});

function assertOffBoard(grid: Grid, spots: Point[]) {
  const tab = 0.22 * Math.min(grid.w, grid.h);
  for (const { x, y } of spots) {
    assert.ok(x >= 0 && y >= 0 && x + grid.w <= TABLE_W && y + grid.h <= TABLE_H);
    const overlaps = x < BOARD_X + PICTURE_W + tab && x + grid.w > BOARD_X - tab
      && y < BOARD_Y + PICTURE_H + tab && y + grid.h > BOARD_Y - tab;
    assert.ok(!overlaps, `piece at ${x},${y} sits on the board`);
  }
}

test('scattered pieces lie on the table and off the board', () => {
  const grid = gridOf(150);
  const spots = scatter(grid, seeded(3));
  assert.equal(spots.length, 150);
  assertOffBoard(grid, spots);
});

test('a piece whose every try lands on the board goes below it', () => {
  for (const count of [24, 150] as const) {
    const grid = gridOf(count);
    const spots = scatter(grid, () => 0.3); // always the middle of the board
    assert.equal(spots.length, count);
    assertOffBoard(grid, spots);
  }
});

test('clamping keeps a piece on the table', () => {
  const grid = gridOf(48);
  const { x, y } = clampToTable(grid, -50, 99999);
  assert.equal(x, 0);
  assert.equal(y, TABLE_H - grid.h);
  const frac = clampToTable(grid, 10.6, 20.2);
  assert.ok(Number.isInteger(frac.x) && Number.isInteger(frac.y));
});
