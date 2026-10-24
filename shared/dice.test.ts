import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollDice, rollDie } from './dice.ts';

test('rollDie maps random to faces', () => {
  assert.equal(rollDie(() => 0), 1);
  assert.equal(rollDie(() => 0.999), 6);
  assert.equal(rollDie(() => 0.5, 20), 11);
});

test('rollDice rolls count dice in order', () => {
  const draws = [0, 0.2, 0.9];
  assert.deepEqual(rollDice(3, () => draws.shift()!), [1, 2, 6]);
  assert.deepEqual(rollDice(0, () => 0), []);
});
