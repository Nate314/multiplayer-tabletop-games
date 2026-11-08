import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveInOrder, movePending } from './placing.ts';

test('a rack tile moves to a new place and the rest keep their order', () => {
  assert.deepEqual(moveInOrder([0, 1, 2, 3, 4, 5, 6], 5, 1), [0, 5, 1, 2, 3, 4, 6]);
  assert.deepEqual(moveInOrder([0, 1, 2, 3, 4, 5, 6], 0, 6), [1, 2, 3, 4, 5, 6, 0]);
  assert.deepEqual(moveInOrder([3, 1, 2], 1, 1), [3, 1, 2]);
});

test('a pending tile moves to another square with its letter, blank and slot', () => {
  const pending = [{ row: 7, col: 7, letter: 'Q', blank: true, slot: 2 }, { row: 7, col: 8, letter: 'I', slot: 0 }];
  assert.deepEqual(movePending(pending, { row: 7, col: 7 }, { row: 6, col: 8 }),
    [{ row: 6, col: 8, letter: 'Q', blank: true, slot: 2 }, { row: 7, col: 8, letter: 'I', slot: 0 }]);
});
