import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { PublicLastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const describe = (lastMove: PublicLastMove | null) => describeMove({ lastMove, playerNames });

// Cell 22 is row 3, column 5
test('an entry names the digit and the cell', () => {
  assert.equal(describe({ type: 'enter', playerNumber: 1, cell: 22, digit: 7 }), 'Alice wrote 7 in row 3, column 5');
});

test('an erase names the cell', () => {
  assert.equal(describe({ type: 'erase', playerNumber: 1, cell: 22 }), 'Alice erased row 3, column 5');
});

test('an own-move undo names the cell', () => {
  assert.equal(describe({ type: 'undoOwn', playerNumber: 1, cell: 22 }), 'Alice took back their move in row 3, column 5');
});

test("another racer's entry hides the cell and digit", () => {
  assert.equal(describe({ type: 'enter', playerNumber: 2 }), 'Bob wrote a digit');
});

test("another racer's erase hides the cell", () => {
  assert.equal(describe({ type: 'erase', playerNumber: 2 }), 'Bob erased a digit');
});

test("another racer's undo hides the cell", () => {
  assert.equal(describe({ type: 'undoOwn', playerNumber: 2 }), 'Bob took back a move');
});

test('the finishing entry of a race names the winner', () => {
  assert.equal(describe({ type: 'enter', playerNumber: 2, finished: true }), 'Bob finished first!');
});

test('the starting position has no move', () => {
  assert.equal(describe(null), '');
});
