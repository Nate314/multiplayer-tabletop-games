import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadVapidKeys, openPushStore } from './pushStore.ts';

test('subscriptions are kept per seat and removed by seat, room and endpoint', () => {
  const store = openPushStore(':memory:');
  store.add('hearts/a', 1, 'e1');
  store.add('hearts/a', 1, 'e1');
  store.add('hearts/a', 1, 'e2');
  store.add('hearts/a', 2, 'e3');
  store.add('hearts/b', 1, 'e1');
  assert.deepEqual(store.endpoints('hearts/a', 1).sort(), ['e1', 'e2']);
  assert.deepEqual(store.roomIds().sort(), ['hearts/a', 'hearts/b']);
  store.removeSeat('hearts/a', 1);
  assert.deepEqual(store.endpoints('hearts/a', 1), []);
  assert.deepEqual(store.endpoints('hearts/a', 2), ['e3']);
  store.removeEndpoint('e3');
  assert.deepEqual(store.endpoints('hearts/a', 2), []);
  assert.deepEqual(store.endpoints('hearts/b', 1), ['e1']);
  store.removeRoom('hearts/b');
  assert.deepEqual(store.roomIds(), []);
  assert.equal(store.getSetting('x'), null);
  store.setSetting('x', '1');
  store.setSetting('x', '2');
  assert.equal(store.getSetting('x'), '2');
  store.close();
});

test('VAPID keys are made once and come back after a reopen', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'push-'));
  try {
    const file = path.join(dir, 'push.db');
    const first = openPushStore(file);
    const a = loadVapidKeys(first);
    first.close();
    const second = openPushStore(file);
    const b = loadVapidKeys(second);
    second.close();
    assert.equal(a.publicKey, b.publicKey);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
