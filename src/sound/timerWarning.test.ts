import { test } from 'node:test';
import assert from 'node:assert/strict';
import { warningSecond } from './timerWarning.ts';

test('the warning covers the last 10 seconds, one tick per whole second', () => {
  assert.equal(warningSecond(null), null);
  assert.equal(warningSecond(10_001), null);
  assert.equal(warningSecond(10_000), 10);
  assert.equal(warningSecond(9_001), 10);
  assert.equal(warningSecond(9_000), 9);
  assert.equal(warningSecond(1), 1);
  assert.equal(warningSecond(0), null);
});
