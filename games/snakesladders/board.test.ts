import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cellOf, jumpFrom, LADDERS, SNAKES } from './board.ts';

test('the layout is the documented eight ladders and eight snakes', () => {
  assert.deepEqual(LADDERS, { 3: 22, 8: 30, 21: 42, 28: 76, 36: 57, 50: 69, 71: 92, 80: 99 });
  assert.deepEqual(SNAKES, { 27: 5, 43: 17, 55: 34, 66: 45, 74: 53, 89: 68, 96: 77, 98: 61 });
});

test('ladders go up, snakes go down, and no move chains', () => {
  const keys = (record: Readonly<Record<number, number>>) => Object.keys(record).map(Number);
  for (const [from, to] of Object.entries(LADDERS)) assert.ok(to > Number(from));
  for (const [from, to] of Object.entries(SNAKES)) assert.ok(to < Number(from));
  const all = [...keys(LADDERS), ...keys(SNAKES), ...Object.values(LADDERS), ...Object.values(SNAKES)];
  for (const square of all) assert.ok(square >= 2 && square <= 99);
  for (const to of [...Object.values(LADDERS), ...Object.values(SNAKES)]) {
    assert.ok(!(to in LADDERS) && !(to in SNAKES));
  }
  for (const from of keys(LADDERS)) assert.ok(!(from in SNAKES));
});

test('jumpFrom finds ladders and snakes', () => {
  assert.deepEqual(jumpFrom(3), { to: 22, via: 'ladder' });
  assert.deepEqual(jumpFrom(98), { to: 61, via: 'snake' });
  assert.equal(jumpFrom(4), null);
});

test('squares snake back and forth from the bottom left', () => {
  assert.deepEqual(cellOf(1), { row: 9, col: 0 });
  assert.deepEqual(cellOf(10), { row: 9, col: 9 });
  assert.deepEqual(cellOf(11), { row: 8, col: 9 });
  assert.deepEqual(cellOf(20), { row: 8, col: 0 });
  assert.deepEqual(cellOf(100), { row: 0, col: 0 });
});
