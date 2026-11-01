import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes a mark by board and cell', () => {
  assert.equal(describeMove({ lastMove: { playerNumber: 2, board: 2, cell: 8, claimed: false }, playerNames, xSeat: 1 }),
    'Bob placed O in the bottom right of the top right board');
});

test('a claiming mark says so', () => {
  assert.equal(describeMove({ lastMove: { playerNumber: 1, board: 4, cell: 0, claimed: true }, playerNames, xSeat: 1 }),
    'Alice placed X in the top left of the center board and claimed it');
});

test('the start has no move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames, xSeat: 1 }), '');
});
