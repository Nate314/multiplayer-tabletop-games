import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAYBACK_SPEEDS, PLAY_STEP_MS, nextPlayIndex, stepDelayMs } from './playback.ts';

test('play from the last step restarts at the first', () => {
  assert.equal(nextPlayIndex(5, 5), 0);
});

test('play from an earlier step starts where it is', () => {
  assert.equal(nextPlayIndex(2, 5), 2);
});

test('play moves one step every 1500 ms', () => {
  assert.equal(PLAY_STEP_MS, 1500);
});

test('the speeds are half, normal, double and four times', () => assert.deepEqual([...PLAYBACK_SPEEDS], [0.5, 1, 2, 4]));

test('each speed divides the 1500 ms step', () => assert.deepEqual(PLAYBACK_SPEEDS.map(stepDelayMs), [3000, 1500, 750, 375]));
