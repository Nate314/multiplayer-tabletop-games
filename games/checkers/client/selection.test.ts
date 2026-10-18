import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCompleteMove, nextSquares } from './selection.ts';
import type { Position } from '../types.ts';

const at = (row: number, col: number): Position => ({ row, col });

// Two pieces can move; the piece at (7,0) has a double jump that branches after its first landing
const legal = [
  [at(7, 0), at(5, 2), at(3, 0)],
  [at(7, 0), at(5, 2), at(3, 4)],
  [at(7, 4), at(5, 6)]
];

test('nothing picked offers each movable piece once', () => {
  assert.deepEqual(nextSquares(legal, []), [at(7, 0), at(7, 4)]);
});

test('each landing offers the squares that continue the jump', () => {
  assert.deepEqual(nextSquares(legal, [at(7, 0)]), [at(5, 2)]);
  assert.deepEqual(nextSquares(legal, [at(7, 0), at(5, 2)]), [at(3, 0), at(3, 4)]);
  assert.deepEqual(nextSquares(legal, [at(7, 0), at(5, 2), at(3, 0)]), []);
});

test('a move is complete only once its last square is picked', () => {
  assert.equal(isCompleteMove(legal, [at(7, 0), at(5, 2)]), false);
  assert.equal(isCompleteMove(legal, [at(7, 0), at(5, 2), at(3, 4)]), true);
  assert.equal(isCompleteMove(legal, [at(7, 4), at(5, 6)]), true);
});
