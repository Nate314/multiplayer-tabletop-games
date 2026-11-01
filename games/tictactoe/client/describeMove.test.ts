import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes a mark by its cell name', () => {
  assert.equal(describeMove({ lastMove: { playerNumber: 2, cell: 8 }, playerNames, xSeat: 1 }), 'Bob placed O in the bottom right');
});

test('the starting position has no move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames, xSeat: 1 }), '');
});
