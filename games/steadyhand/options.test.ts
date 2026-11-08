import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standardOf } from '../../shared/houseRules.ts';
import { BUZZES_RULE, TOLERANCE } from './options.ts';
import { PARTS } from './board.ts';
import { clearance } from './geometry.ts';

test('Buzzes allowed is 3 at every seat count', () => {
  for (const seats of [1, 2, 8]) assert.equal(standardOf(BUZZES_RULE, seats), 3);
  assert.deepEqual(BUZZES_RULE.choices.map(c => c.label), ['Unlimited', '1', '3', '5']);
});

test('every tolerance leaves room to move in every slot', () => {
  for (const part of PARTS) assert.ok(clearance(part, TOLERANCE.hard) >= 4, part.name);
});
