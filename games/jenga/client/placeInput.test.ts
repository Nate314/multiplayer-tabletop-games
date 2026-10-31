import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HELD_REST_DISTANCE, restPose, snapSlot } from './placeInput.ts';
import { BLOCK, TURNTABLE } from '../physics.ts';

test('snapSlot picks the nearest open spot within reach', () => {
  const targets = [{ slot: 0 as const, x: 100, y: 0 }, { slot: 1 as const, x: 140, y: 0 }, { slot: 2 as const, x: 180, y: 0 }];
  assert.equal(snapSlot({ x: 138, y: 5 }, targets), 1);
  assert.equal(snapSlot({ x: 100, y: 40 }, targets), null);
  assert.equal(snapSlot({ x: 138, y: 5 }, []), null);
});

test('the held block rests on the ground beyond the turntable, toward the camera', () => {
  for (const yaw of [0, 1, -2]) {
    const { p } = restPose(yaw);
    const flat = Math.hypot(p[0], p[2]);
    assert.ok(Math.abs(flat - HELD_REST_DISTANCE) < 1e-9);
    assert.ok(flat - BLOCK.width / 2 > TURNTABLE.radius);
    assert.ok(Math.abs(p[0] / p[2] - Math.tan(yaw)) < 1e-9);
    // Toward the camera, not away from it
    assert.ok(p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw) > 0);
    assert.equal(p[1], BLOCK.height / 2 - TURNTABLE.height);
  }
});
