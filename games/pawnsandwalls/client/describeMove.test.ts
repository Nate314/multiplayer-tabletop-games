import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes a pawn move', () => {
  const lastMove = { type: 'move' as const, playerNumber: 2, from: { row: 0, col: 4 }, to: { row: 1, col: 4 } };
  assert.equal(describeMove({ lastMove, playerNames }), 'Bob moved');
});

test('describes a wall placement', () => {
  const lastMove = { type: 'wall' as const, playerNumber: 1, row: 3, col: 2, orientation: 'horizontal' as const };
  assert.equal(describeMove({ lastMove, playerNames }), 'Alice placed a wall');
});
