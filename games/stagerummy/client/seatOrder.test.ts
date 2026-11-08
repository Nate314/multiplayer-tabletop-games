import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seatOrder } from './seatOrder.ts';

const eight = [1, 2, 3, 4, 5, 6, 7, 8];

test('the viewer comes first and the others follow in turn order at an eight-seat table', () => {
  assert.deepEqual(seatOrder(eight, 1), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(seatOrder(eight, 7), [7, 8, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(seatOrder(eight, 8), [8, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(seatOrder(eight, 2), [2, 3, 4, 5, 6, 7, 8, 1]);
});

test('seats that left are skipped without breaking the order', () => {
  assert.deepEqual(seatOrder([1, 3, 8], 3), [3, 8, 1]);
  assert.deepEqual(seatOrder([2, 4], 4), [4, 2]);
});
