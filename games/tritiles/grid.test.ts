import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from './tiles.ts';
import {
  cellKey, edgeNeighbours, fits, hexagonsCompleted, isBridge, openPlacements, pointNeighbours, rotations, verticesOf
} from './grid.ts';
import type { Board, Cell, Placed } from './grid.ts';

const id = (a: number, b: number, c: number) => TILES.findIndex(t => t.join() === `${a},${b},${c}`);
const up = (x: number, y: number): Cell => ({ x, y, up: true });
const down = (x: number, y: number): Cell => ({ x, y, up: false });
// The tile id is irrelevant to the geometry; the corners are what count
const at = (cell: Cell, corners: [number, number, number]): Placed => ({ tile: 0, cell, corners });
const zeros = (cells: Cell[]): Board => cells.map(cell => at(cell, [0, 0, 0]));
const keys = (cells: Cell[]) => cells.map(cellKey).sort();
const sharedVertices = (a: Cell, b: Cell) => verticesOf(a).filter(v => verticesOf(b).includes(v)).length;

const sample: Cell[] = [];
for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) sample.push(up(x, y), down(x, y));

test('each cell has 3 edge neighbours and 9 point neighbours', () => {
  for (const cell of sample) {
    const edges = edgeNeighbours(cell);
    const points = pointNeighbours(cell);
    assert.equal(new Set(keys(edges)).size, 3);
    assert.equal(new Set(keys(points)).size, 9);
    for (const other of edges) {
      assert.notEqual(other.up, cell.up);
      assert.equal(sharedVertices(cell, other), 2);
    }
    for (const other of points) assert.equal(sharedVertices(cell, other), 1);
    assert.ok(!keys([...edges, ...points]).includes(cellKey(cell)));
  }
});

test('neighbours are symmetric', () => {
  for (const cell of sample) {
    for (const other of edgeNeighbours(cell)) assert.ok(keys(edgeNeighbours(other)).includes(cellKey(cell)));
    for (const other of pointNeighbours(cell)) assert.ok(keys(pointNeighbours(other)).includes(cellKey(cell)));
  }
});

test('two cells sharing an edge read it in opposite directions, so both orders are clockwise', () => {
  const directed = (cell: Cell) => {
    const [a, b, c] = verticesOf(cell);
    return [`${a}>${b}`, `${b}>${c}`, `${c}>${a}`];
  };
  for (const cell of sample) {
    for (const other of edgeNeighbours(cell)) {
      const reversed = directed(other).map(e => e.split('>').reverse().join('>'));
      assert.equal(directed(cell).filter(e => reversed.includes(e)).length, 1);
    }
  }
});

test('vertices run clockwise on screen with point (i, j) drawn at (i - j / 2, j * h)', () => {
  for (const cell of sample) {
    const pts = verticesOf(cell).map(v => v.split(',').map(Number)).map(([i, j]) => [i - j / 2, j * Math.sqrt(3) / 2]);
    // With y pointing down, a positive shoelace sum is clockwise
    const area = pts.reduce((sum, [x1, y1], k) => { const [x2, y2] = pts[(k + 1) % 3]; return sum + x1 * y2 - x2 * y1; }, 0);
    assert.ok(Math.abs(area - Math.sqrt(3) / 2) < 1e-9);
    // An up cell starts at its apex above a flat base; a down cell starts on its flat top
    assert.equal(cell.up ? pts[1][1] === pts[2][1] && pts[0][1] < pts[1][1] : pts[0][1] === pts[1][1] && pts[2][1] > pts[0][1], true);
  }
});

test('rotations of a triple is one entry, of 0-1-2 is three', () => {
  assert.deepEqual(rotations(id(3, 3, 3)), [[3, 3, 3]]);
  assert.deepEqual(rotations(id(0, 1, 2)), [[0, 1, 2], [1, 2, 0], [2, 0, 1]]);
  assert.equal(rotations(id(0, 0, 4)).length, 3);
});

test('the first tile fits anywhere on the empty board', () => {
  assert.ok(fits([], up(0, 0), [0, 1, 2]));
  assert.ok(fits([], down(7, -4), [5, 5, 5]));
  assert.deepEqual(openPlacements([], id(0, 1, 2)), [
    { cell: up(0, 0), corners: [0, 1, 2] }, { cell: up(0, 0), corners: [1, 2, 0] }, { cell: up(0, 0), corners: [2, 0, 1] }
  ]);
  assert.deepEqual(openPlacements([], id(4, 4, 4)), [{ cell: up(0, 0), corners: [4, 4, 4] }]);
});

test('an occupied cell is refused', () => {
  assert.ok(!fits(zeros([up(0, 0)]), up(0, 0), [0, 0, 0]));
});

test('a cell with no edge neighbour is refused', () => {
  // down(0,0) and up(1,1) share only the point (1,1), and the number there matches
  const board = [at(down(0, 0), [1, 2, 3])];
  assert.equal(verticesOf(up(1, 1))[0], verticesOf(down(0, 0))[2]);
  assert.ok(!fits(board, up(1, 1), [3, 4, 4]));
});

test('an edge match with the right numbers fits', () => {
  // down(0,0) reads (0,0) (1,0) (1,1); up(0,0) reads (0,0) (1,1) (0,1), so it needs 1 then 3
  const board = [at(down(0, 0), [1, 2, 3])];
  assert.ok(fits(board, up(0, 0), [1, 3, 5]));
  assert.ok(!fits(board, up(0, 0), [3, 1, 5]));
  assert.ok(!fits(board, up(0, 0), [1, 4, 5]));
});

test('a point-only clash refuses the placement', () => {
  // The edge with down(0,0) matches, but up(0,1) already put a 5 on the far vertex (0,1)
  const board = [at(down(0, 0), [1, 2, 3]), at(up(0, 1), [5, 5, 5])];
  assert.equal(verticesOf(up(0, 0))[2], verticesOf(up(0, 1))[0]);
  assert.ok(!fits(board, up(0, 0), [1, 3, 4]));
  assert.ok(fits(board, up(0, 0), [1, 3, 5]));
});

test('openPlacements lists each fitting cell and rotation once', () => {
  const board = zeros([up(0, 0)]);
  const found = openPlacements(board, id(0, 0, 1));
  // One rotation per side: the 1 must land on the free vertex
  assert.deepEqual(keys(found.map(p => p.cell)), keys(edgeNeighbours(up(0, 0))));
  const taken = new Set(verticesOf(up(0, 0)));
  for (const { cell, corners } of found) {
    verticesOf(cell).forEach((v, i) => assert.equal(corners[i], taken.has(v) ? 0 : 1));
  }
  assert.equal(openPlacements(board, id(0, 0, 0)).length, 3);
  assert.deepEqual(openPlacements(board, id(0, 1, 2)), []);

  const two = [at(down(0, 0), [1, 2, 3]), at(up(1, 0), [2, 2, 3])]; // down(0,0) and up(1,0) share the edge (1,0)-(1,1)
  const plays = openPlacements(two, id(1, 1, 3));
  assert.equal(new Set(plays.map(p => `${cellKey(p.cell)}:${p.corners}`)).size, plays.length);
  for (const p of plays) assert.ok(fits(two, p.cell, p.corners));
  assert.deepEqual(plays, [{ cell: up(0, 0), corners: [1, 3, 1] }]);
});

test('six tiles around a point complete one hexagon', () => {
  const around = [up(0, 0), up(-1, -1), up(0, -1), down(0, 0), down(-1, 0), down(-1, -1)];
  assert.ok(around.every(cell => verticesOf(cell).includes('0,0')));
  assert.equal(hexagonsCompleted(zeros(around.slice(1)), up(0, 0)), 1);
  assert.equal(hexagonsCompleted(zeros(around.slice(2)), up(0, 0)), 0);
});

test('one tile closing two hexagons returns 2', () => {
  // up(0,0) touches the points (0,0) and (1,1); fill the other cells around both
  const others = [up(-1, -1), up(0, -1), down(0, 0), down(-1, 0), down(-1, -1), up(1, 1), up(1, 0), down(1, 1), down(0, 1)];
  assert.equal(hexagonsCompleted(zeros(others), up(0, 0)), 2);
});

test('a tile matching one edge with its opposite vertex already numbered is a bridge', () => {
  // up(0,0) meets down(0,0) along an edge; its opposite vertex (0,1) is a corner of up(0,1), which shares no edge with it
  const board = [at(down(0, 0), [1, 2, 3]), at(up(0, 1), [5, 5, 5])];
  assert.ok(isBridge(board, up(0, 0)));
  assert.ok(!isBridge(board.slice(0, 1), up(0, 0)));
});

test('the same tile with two edge neighbours is not a bridge', () => {
  const board = [at(down(0, 0), [1, 2, 3]), at(up(0, 1), [5, 5, 5]), at(down(0, 1), [5, 3, 5])];
  assert.ok(!isBridge(board, up(0, 0)));
});
