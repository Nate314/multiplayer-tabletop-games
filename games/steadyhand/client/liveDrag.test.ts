import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawnPosition, partAt, shouldSend, stepDrag } from './liveDrag.ts';
import { PARTS } from '../board.ts';
import type { Live, Point } from '../types.ts';

const gear = PARTS[1];

test('sends at most one drag per 50 ms', () => {
  assert.equal(shouldSend(1000, 1049), false);
  assert.equal(shouldSend(1000, 1050), true);
});

test('the dragger draws the local position', () => {
  const a: Point = [300, 260];
  const b: Point = [320, 260];
  const live: Live = { seat: 1, part: gear.id, at: a };
  assert.deepEqual(drawnPosition(live, 1, b), b);
  assert.deepEqual(drawnPosition(live, 2, b), a);
  assert.equal(drawnPosition(null, 1, b), null);
});

test('a step through the wall buzzes', () => {
  // From the Gear's rest spot straight up across the wall to its upper run, skipping the slot's corner
  assert.equal(stepDrag(gear, [240, 260], [240, 170], 1).result, 'buzz');
  assert.equal(stepDrag(gear, [240, 260], [300, 260], 1).result, 'inside');
  assert.equal(stepDrag(gear, [240, 40], [240, 24], 1).result, 'out');
});

test('a point outside the bay is clamped into it', () => {
  assert.deepEqual(stepDrag(gear, [240, 260], [-50, 900], 1), { at: [0, 640], result: 'buzz' });
});

test('a press picks the nearest part in reach', () => {
  assert.equal(partAt(PARTS, [245, 255], 22)?.id, 1);
  assert.equal(partAt(PARTS, [600, 320], 22), undefined);
});
