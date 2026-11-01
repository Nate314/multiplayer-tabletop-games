import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { Hole, Seat } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob', 3: 'Cara' };
const at = (...coords: [number, number][]): Hole[] => coords.map(([q, r]) => ({ q, r }));
const describe = (playerNumber: Seat, path: Hole[], winners: Seat[] = []) =>
  describeMove({ lastMove: { playerNumber, path }, playerNames, isGameOver: winners.length > 0, winners });

test('describes a step', () => {
  assert.equal(describe(1, at([0, 0], [1, 0])), 'Alice moved a marble');
});

test('describes one jump', () => {
  assert.equal(describe(1, at([0, 0], [2, 0])), 'Alice made 1 jump');
});

test('describes a chain of jumps', () => {
  assert.equal(describe(2, at([0, 0], [2, 0], [4, 0], [4, 2])), 'Bob made 3 jumps');
});

test('describes the winning move', () => {
  assert.equal(describe(3, at([0, 0], [2, 0], [2, 2]), [3]), 'Cara made 2 jumps and won');
});

test('the starting position has no move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames, isGameOver: false, winners: [] }), '');
});
