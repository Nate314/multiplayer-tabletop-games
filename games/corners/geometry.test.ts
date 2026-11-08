import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PIECES,
  SQUARE_STARTS,
  TRIANGLE_STARTS,
  boardCells,
  cellKey,
  corners,
  cornerTouch,
  edgeTouch,
  orientations,
  type Cell,
  type Shape
} from './geometry.ts';

const sizes = (shapes: Shape[]): Record<number, number> => {
  const out: Record<number, number> = {};
  for (const s of shapes) out[s.length] = (out[s.length] ?? 0) + 1;
  return out;
};
const total = (shapes: Shape[]): number => shapes.reduce((n, s) => n + s.length, 0);
const at = (cells: Cell[], c: Cell): Cell => cells.find((o) => cellKey(o) === cellKey(c))!;

test('the squares board has 400 cells and the triangles board 486', () => {
  const sq = boardCells('squares');
  const tr = boardCells('triangles');
  assert.equal(sq.length, 400);
  assert.equal(tr.length, 486);
  assert.equal(new Set(sq.map(cellKey)).size, 400);
  assert.equal(new Set(tr.map(cellKey)).size, 486);
});

test('piece sets are every free shape: 21 squares pieces and 22 triangles pieces', () => {
  assert.equal(PIECES.squares.length, 21);
  assert.deepEqual(sizes(PIECES.squares), { 1: 1, 2: 1, 3: 2, 4: 5, 5: 12 });
  assert.equal(total(PIECES.squares), 89);
  assert.equal(PIECES.triangles.length, 22);
  assert.deepEqual(sizes(PIECES.triangles), { 1: 1, 2: 1, 3: 1, 4: 3, 5: 4, 6: 12 });
  assert.equal(total(PIECES.triangles), 110);
  assert.equal(PIECES.squares[0].length, 1);
  assert.equal(PIECES.triangles[0].length, 1);
});

test('a square has 4 edge neighbors and 4 corner neighbors inside the board', () => {
  const cells = boardCells('squares');
  const me = at(cells, [5, 5, 0]);
  assert.equal(cells.filter((c) => edgeTouch('squares', me, c)).length, 4);
  assert.equal(cells.filter((c) => cornerTouch('squares', me, c)).length, 4);
  assert.equal(corners('squares', me).length, 4);
});

test('an inner triangle has 3 edge neighbors and 9 corner neighbors', () => {
  const cells = boardCells('triangles');
  for (const c of [[0, 0, 0], [0, 0, 1]] as Cell[]) {
    const me = at(cells, c);
    assert.equal(cells.filter((o) => edgeTouch('triangles', me, o)).length, 3);
    assert.equal(cells.filter((o) => cornerTouch('triangles', me, o)).length, 9);
    assert.equal(corners('triangles', me).length, 3);
  }
});

test('orientations: the long bar has 2 on squares, the 2 by 2 block 1, the bent five-square piece 8', () => {
  const count = (cells: string[]): number => {
    const shape = cells.map((k) => k.split(',').map(Number) as unknown as Cell);
    return orientations('squares', shape).length;
  };
  assert.equal(count(['0,0,0', '1,0,0', '2,0,0', '3,0,0', '4,0,0']), 2);
  assert.equal(count(['0,0,0', '1,0,0', '0,1,0', '1,1,0']), 1);
  assert.equal(count(['0,0,0', '1,0,0', '1,1,0', '2,1,0', '1,2,0']), 8);
  assert.equal(orientations('triangles', [[0, 0, 0]]).length, 2);
  const bar: Shape = [[0, 0, 0], [0, 0, 1], [1, 0, 0], [1, 0, 1], [2, 0, 0], [2, 0, 1]];
  assert.equal(orientations('triangles', bar).length, 6);
});

test('the six triangle starts are distinct cells on the board, turned 60 degrees from each other', () => {
  const board = new Set(boardCells('triangles').map(cellKey));
  assert.equal(TRIANGLE_STARTS.length, 6);
  assert.equal(new Set(TRIANGLE_STARTS.map(cellKey)).size, 6);
  for (const s of TRIANGLE_STARTS) assert.ok(board.has(cellKey(s)));
  const turn = (p: string): string => {
    const [x, y] = p.split(',').map(Number);
    return `${-y},${x + y}`;
  };
  TRIANGLE_STARTS.forEach((s, k) => {
    const next = TRIANGLE_STARTS[(k + 1) % 6];
    assert.deepEqual(corners('triangles', s).map(turn).sort(), corners('triangles', next).sort());
  });
});

test('every corner of the squares board is a start', () => {
  assert.deepEqual(SQUARE_STARTS.map(cellKey), ['0,0,0', '19,0,0', '19,19,0', '0,19,0']);
  const board = new Set(boardCells('squares').map(cellKey));
  for (const s of SQUARE_STARTS) assert.ok(board.has(cellKey(s)));
});
