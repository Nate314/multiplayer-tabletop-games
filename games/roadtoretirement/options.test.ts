import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standardOf } from '../../shared/houseRules.ts';
import { BOARD_RULE, LENGTH_RULE, STARTING_CASH_RULE } from './options.ts';

test('the standard board is Road to Retirement', () => {
  assert.equal(standardOf(BOARD_RULE, 2), 'road');
  assert.deepEqual(BOARD_RULE.choices.map(c => c.label), ['Road to Retirement', '1860 Checkered']);
});

test('game length and starting cash are offered only on the road board', () => {
  for (const rule of [LENGTH_RULE, STARTING_CASH_RULE]) {
    assert.equal(rule.offered!(2, { board: 'checkered' }), false);
    assert.equal(rule.offered!(2, { board: 'road' }), true);
  }
});

test('starting cash choices', () => {
  assert.deepEqual(STARTING_CASH_RULE.choices.map(c => c.value), [10000, 25000, 50000]);
  assert.deepEqual(STARTING_CASH_RULE.choices.map(c => c.label), ['$10,000', '$25,000', '$50,000']);
  assert.equal(STARTING_CASH_RULE.standard, 25000);
});
