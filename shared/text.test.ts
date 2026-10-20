import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plural } from './text.ts';

test('plural matches the old copies', () => {
  assert.equal(plural(1, 'tile'), '1 tile');
  assert.equal(plural(2, 'tile'), '2 tiles');
  assert.equal(plural(0, 'card'), '0 cards');
  assert.equal(plural(3, 'complete row'), '3 complete rows');
  assert.equal(plural(1, 'army', 'armies'), '1 army');
  assert.equal(plural(2, 'army', 'armies'), '2 armies');
});
