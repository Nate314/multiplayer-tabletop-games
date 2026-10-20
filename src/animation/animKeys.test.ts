import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handKey, seatKey, trickKey } from './animKeys.ts';

test('keys keep the strings the games animate by', () => {
  assert.equal(handKey(3), 'hand-3');
  assert.equal(seatKey(2), 'seat-2');
  assert.equal(trickKey(1), 'trick-1');
});
