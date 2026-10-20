import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes a drop by its column, counted from one', () => {
  assert.equal(describeMove({ lastMove: { playerNumber: 2, row: 5, column: 6 }, playerNames }), 'Bob dropped a disc in column 7');
});

test('the starting position has no move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames }), '');
});
