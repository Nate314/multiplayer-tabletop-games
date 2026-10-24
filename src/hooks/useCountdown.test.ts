import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatClock } from './useCountdown.ts';

test('formatClock shows minutes and seconds and never goes below zero', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(999), '0:01');
  assert.equal(formatClock(61000), '1:01');
  assert.equal(formatClock(600000), '10:00');
  assert.equal(formatClock(-5), '0:00');
});
