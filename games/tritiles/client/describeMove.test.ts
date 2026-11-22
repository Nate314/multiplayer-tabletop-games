import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import { TILES } from '../tiles.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });
const tile = (a: number, b: number, c: number) => TILES.findIndex(t => t.join() === [a, b, c].join());
const cell = { x: 1, y: 0, up: false };

test('describes a play by its tile and score, with any bonus and going out', () => {
  assert.equal(describe({
    type: 'play', playerNumber: 1, tile: tile(2, 4, 5), cell, corners: [4, 5, 2],
    score: { points: 11, lines: [{ label: 'Tile', points: 11 }] }, wentOut: false
  }), 'Alice played 2-4-5 for 11');
  assert.equal(describe({
    type: 'play', playerNumber: 1, tile: tile(3, 3, 5), cell, corners: [3, 3, 5],
    score: { points: 51, lines: [{ label: 'Tile', points: 11 }, { label: 'Hexagon', points: 50 }] }, wentOut: false
  }), 'Alice played 3-3-5 for 51 (hexagon)');
  assert.equal(describe({
    type: 'play', playerNumber: 2, tile: tile(0, 1, 2), cell, corners: [0, 1, 2],
    score: { points: 3, lines: [{ label: 'Tile', points: 3 }] }, wentOut: true
  }), 'Bob played 0-1-2 for 3 and went out');
});

test('describes draws and passes with their cost, and nothing for no move', () => {
  assert.equal(describe({ type: 'draw', playerNumber: 2, penalty: 5 }), 'Bob drew a tile (-5)');
  assert.equal(describe({ type: 'pass', playerNumber: 2, penalty: 10 }), 'Bob passed (-10)');
  assert.equal(describe(null), '');
});
