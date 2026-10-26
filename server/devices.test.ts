import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashDeviceId } from './devices.ts';

test('a device ID is hashed to 64 hex characters, stably', () => {
  const hash = hashDeviceId('a'.repeat(32));
  assert.match(hash ?? '', /^[0-9a-f]{64}$/);
  assert.equal(hashDeviceId('a'.repeat(32)), hash);
  assert.notEqual(hashDeviceId('b'.repeat(32)), hash);
});

test('anything but 16 to 64 letters, digits and dashes is not a device ID', () => {
  for (const raw of ['short', 'x'.repeat(65), 'a b'.repeat(8), 5, undefined, null]) assert.equal(hashDeviceId(raw), null);
  assert.notEqual(hashDeviceId('a-1'.repeat(6)), null);
});
