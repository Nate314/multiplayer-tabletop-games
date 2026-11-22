import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILES } from './tiles.ts';
import { cellKey, verticesOf } from './grid.ts';
import type { Board, Cell } from './grid.ts';
import { openingScore, playScore, roundEndScores } from './scoring.ts';

const id = (a: number, b: number, c: number) => TILES.findIndex(t => t.join() === `${a},${b},${c}`);
const up = (x: number, y: number): Cell => ({ x, y, up: true });
const down = (x: number, y: number): Cell => ({ x, y, up: false });
const both = { hexagon: true, bridge: true };
const neither = { hexagon: false, bridge: false };
const tile = id(1, 2, 3); // sum 6

// The six cells around a lattice point, for building a board that is one tile short of a hexagon
function around(i: number, j: number): Cell[] {
  return [up(i, j), up(i - 1, j - 1), up(i, j - 1), down(i, j), down(i - 1, j), down(i - 1, j - 1)];
}
// Every cell around the given vertices of `cell`, except `cell` itself
function gapBoard(cell: Cell, vertexCount: number): Board {
  const cells = new Map<string, Cell>();
  for (const v of verticesOf(cell).slice(0, vertexCount)) {
    const [i, j] = v.split(',').map(Number);
    for (const c of around(i, j)) cells.set(cellKey(c), c);
  }
  cells.delete(cellKey(cell));
  return [...cells.values()].map(c => ({ tile: 0, cell: c, corners: [0, 0, 0] as [number, number, number] }));
}

test('opening score: a triple adds 10, 0-0-0 scores 40, other tiles score their sum', () => {
  assert.equal(openingScore(id(4, 4, 4)).points, 22);
  assert.equal(openingScore(id(0, 0, 0)).points, 40);
  assert.equal(openingScore(id(2, 4, 5)).points, 11);
  assert.deepEqual(openingScore(id(0, 0, 0)).lines, [{ label: 'Triple', points: 40 }]);
});

test('a plain play scores its sum', () => {
  assert.equal(playScore([], up(0, 0), tile, neither).points, 6);
});

test('hexagons score 50 each, up to 3 in one move', () => {
  for (const n of [1, 2, 3]) {
    const cell = down(0, 0);
    const board = gapBoard(cell, n);
    const result = playScore(board, cell, tile, both);
    assert.equal(result.points, 6 + 50 * n, `${n} hexagons`);
    assert.deepEqual(result.lines.at(-1), { label: n === 1 ? 'Hexagon' : `${n} hexagons`, points: 50 * n });
  }
});

test('hexagon off scores just the sum', () => {
  const cell = down(0, 0);
  assert.equal(playScore(gapBoard(cell, 1), cell, tile, { hexagon: false, bridge: true }).points, 6);
});

test('a bridge scores 40, and only while the bonus is on', () => {
  const board: Board = [up(0, 0), up(1, -1)].map(cell => ({ tile: 0, cell, corners: [0, 0, 0] }));
  assert.equal(playScore(board, down(0, 0), tile, both).points, 46);
  assert.deepEqual(playScore(board, down(0, 0), tile, both).lines.at(-1), { label: 'Bridge', points: 40 });
  assert.equal(playScore(board, down(0, 0), tile, neither).points, 6);
});

test('going out scores 25 plus every other hand', () => {
  const hands = { 0: [], 1: [id(1, 2, 3)], 2: [id(5, 5, 5), id(0, 0, 1)] };
  assert.deepEqual(roundEndScores(hands, 0), { 0: 25 + 6 + 16, 1: 0, 2: 0 });
});

test('a blocked round pays the lowest hand the differences', () => {
  const hands = { 0: [id(0, 0, 1)], 1: [id(1, 2, 3)], 2: [id(5, 5, 5)] }; // 1, 6, 15
  assert.deepEqual(roundEndScores(hands, null), { 0: 5 + 14, 1: 0, 2: 0 });
});

test('a tie for lowest in a blocked round scores nothing', () => {
  const hands = { 0: [id(0, 0, 1)], 1: [id(0, 0, 1)], 2: [id(5, 5, 5)] };
  assert.deepEqual(roundEndScores(hands, null), { 0: 0, 1: 0, 2: 0 });
});
