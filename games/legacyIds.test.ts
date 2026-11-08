import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from './registry.ts';
import { currentId, keepsSaves, LEGACY_IDS, type LegacyIds } from './legacyIds.ts';

const TEST: LegacyIds = { oldgame: { id: 'newgame', keepsSaves: true }, oldmap: { id: 'newmap', keepsSaves: false } };

test('currentId maps an old id and leaves others', () => {
  assert.equal(currentId('oldgame', TEST), 'newgame');
  assert.equal(currentId('newgame', TEST), 'newgame');
  assert.equal(currentId('chess', TEST), 'chess');
});

test('currentId ignores the object prototype', () => {
  for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    assert.equal(currentId(name, TEST), name);
  }
});

test('keepsSaves is false only for a reshaped old id', () => {
  assert.equal(keepsSaves('oldgame', TEST), true);
  assert.equal(keepsSaves('oldmap', TEST), false);
  assert.equal(keepsSaves('chess', TEST), true);
  assert.equal(keepsSaves('constructor', TEST), true);
});

test('every legacy entry points at a registered game and no old id is still registered', () => {
  for (const [old, { id }] of Object.entries(LEGACY_IDS)) {
    assert.ok(GAMES.some(g => g.info.id === id), `${old} -> ${id} is not registered`);
    assert.ok(!GAMES.some(g => g.info.id === old), `${old} is still registered`);
    assert.notEqual(old, id);
    assert.ok(!Object.hasOwn(LEGACY_IDS, id), `${old} chains through ${id}`);
  }
});
