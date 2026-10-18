import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAY_STEP_MS, nextPlayIndex } from './playback.ts';

test('play from the last step restarts at the first', () => {
  assert.equal(nextPlayIndex(5, 5), 0);
});

test('play from an earlier step starts where it is', () => {
  assert.equal(nextPlayIndex(2, 5), 2);
});

test('play moves one step every 1500 ms', () => {
  assert.equal(PLAY_STEP_MS, 1500);
});
