import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DROP_SNAP_MS, markDropped, takeDrop } from './recentDrop.ts';

test('a drop is taken once', () => {
  markDropped(1000);
  assert.equal(takeDrop(1500), true);
  assert.equal(takeDrop(1500), false);
});

test('a drop older than DROP_SNAP_MS is not taken', () => {
  markDropped(1000);
  assert.equal(takeDrop(1000 + DROP_SNAP_MS + 1), false);
});
