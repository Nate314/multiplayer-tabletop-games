import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCORING_TABLE, score } from './scoring.ts';

test('single 1s are 100 and single 5s 50', () => {
  assert.equal(score([1]), 100);
  assert.equal(score([5]), 50);
  assert.equal(score([1, 1]), 200);
  assert.equal(score([5, 5]), 100);
  assert.equal(score([1, 5]), 150);
});

test('every combination in the copied table scores its value', () => {
  for (const { name, dice, points } of SCORING_TABLE) {
    assert.equal(score(dice), points, name);
    assert.equal(score([...dice].reverse()), points, `${name} in another order`);
  }
});

test('a selection with a non-scoring die is refused', () => {
  assert.equal(score([2]), null);
  assert.equal(score([1, 2]), null);
  assert.equal(score([2, 2]), null);
  assert.equal(score([3, 3, 4]), null);
  assert.equal(score([1, 1, 1, 2]), null);
  assert.equal(score([2, 2, 3, 3, 4, 6]), null);
  assert.equal(score([]), null);
});

test('the best way to split the dice is used', () => {
  assert.equal(score([1, 1, 1, 5]), 1050);
  assert.equal(score([5, 5, 5, 1]), 600);
  assert.equal(score([1, 1, 1, 1]), 1100, 'three ones and a single beat four of a kind');
  assert.equal(score([2, 2, 2, 2, 5, 5]), 1100, 'four of a kind and two fives');
  assert.equal(score([1, 1, 2, 2, 3, 3]), 1500);
  assert.equal(score([2, 2, 2, 2, 3, 3]), null, 'four and a pair is not three pair');
});
