import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes a move in algebraic notation', () => {
  const lastMove = { type: 'move' as const, playerNumber: 1, from: { row: 7, col: 6 }, to: { row: 5, col: 5 }, notation: 'Nf3' };
  assert.equal(describeMove({ lastMove, playerNames }), 'Alice played Nf3');
});

test('describes a resignation', () => {
  const lastMove = { type: 'resign' as const, playerNumber: 2 };
  assert.equal(describeMove({ lastMove, playerNames }), 'Bob resigned');
});

test('describes nothing before the first move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames }), '');
});
