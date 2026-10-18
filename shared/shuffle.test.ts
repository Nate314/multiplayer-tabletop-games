import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shuffle } from './shuffle.ts';

test('shuffle keeps every item and leaves the input alone', () => {
  const items = [1, 2, 3, 4, 5, 6];
  let seed = 0.37;
  const random = () => (seed = (seed * 7.13) % 1);
  const result = shuffle(items, random);
  assert.deepEqual(items, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...result].sort((a, b) => a - b), items);
});

test('shuffle follows random', () => {
  assert.deepEqual(shuffle([1, 2, 3, 4], () => 0), [2, 3, 4, 1]);
});
