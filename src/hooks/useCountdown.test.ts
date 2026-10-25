import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, formatTurnClock } from './useCountdown.ts';

test('formatClock shows minutes and seconds and never goes below zero', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(999), '0:01');
  assert.equal(formatClock(61000), '1:01');
  assert.equal(formatClock(600000), '10:00');
  assert.equal(formatClock(-5), '0:00');
});

test('formatTurnClock counts overtime up with a plus', () => {
  assert.equal(formatTurnClock(61_000), '1:01');
  assert.equal(formatTurnClock(0), '0:00');
  assert.equal(formatTurnClock(-1), '+0:01');
  assert.equal(formatTurnClock(-42_000), '+0:42');
  assert.equal(formatTurnClock(-300_000), '+5:00');
});
