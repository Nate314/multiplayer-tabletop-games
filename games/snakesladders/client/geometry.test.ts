import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centerOf, pathOf, stackOffset } from './geometry.ts';
import type { LastMove } from '../types.ts';

const roll = (from: number, value: number, landed: number, to: number, via: LastMove['via'], stayed = false): LastMove =>
  ({ type: 'roll', playerNumber: 1, roll: value, from, landed, to, via, stayed, again: false });

test('centers follow the boustrophedon numbering', () => {
  assert.deepEqual(centerOf(1), { x: 5, y: 95 });
  assert.deepEqual(centerOf(10), { x: 95, y: 95 });
  assert.deepEqual(centerOf(11), { x: 95, y: 85 });
  assert.deepEqual(centerOf(100), { x: 5, y: 5 });
});

test('six tokens on one square stay inside the cell and apart', () => {
  const offsets = Array.from({ length: 6 }, (_, index) => stackOffset(index, 6));
  assert.equal(new Set(offsets.map(({ dx, dy }) => `${dx},${dy}`)).size, 6);
  for (const { dx, dy } of offsets) {
    assert.ok(Math.abs(dx) <= 3.5, `dx ${dx}`);
    assert.ok(Math.abs(dy) <= 3.5, `dy ${dy}`);
  }
  assert.deepEqual(stackOffset(0, 1), { dx: 0, dy: 0 });
});

test('the path walks each square then jumps', () => {
  assert.deepEqual(pathOf(roll(1, 2, 3, 22, 'ladder')), [1, 2, 3, 22]);
  assert.deepEqual(pathOf(roll(24, 3, 27, 5, 'snake')), [24, 25, 26, 27, 5]);
  assert.deepEqual(pathOf(roll(97, 5, 97, 97, null, true)), []);
});
