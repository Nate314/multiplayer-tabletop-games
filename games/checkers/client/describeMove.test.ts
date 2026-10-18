import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes a step', () => {
  const lastMove = { playerNumber: 2, path: [{ row: 2, col: 1 }, { row: 3, col: 0 }], captured: [], crowned: false };
  assert.equal(describeMove({ lastMove, playerNames }), 'Bob moved');
});

test('describes a double jump that crowns a king', () => {
  const lastMove = {
    playerNumber: 1,
    path: [{ row: 4, col: 1 }, { row: 2, col: 3 }, { row: 0, col: 1 }],
    captured: [{ row: 3, col: 2 }, { row: 1, col: 2 }],
    crowned: true
  };
  assert.equal(describeMove({ lastMove, playerNames }), 'Alice captured 2 pieces and crowned a king');
});

test('the starting position has no move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames }), '');
});
