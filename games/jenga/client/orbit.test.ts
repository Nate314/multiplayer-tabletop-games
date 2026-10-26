import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ORBIT, cameraPosition, orbitBy, zoomBy } from './orbit.ts';

const degrees = (radians: number) => radians * 180 / Math.PI;

test('dragging right turns the camera and pitch stays between 5 and 85 degrees', () => {
  const turned = orbitBy(DEFAULT_ORBIT, 100, 0);
  assert.ok(turned.yaw > DEFAULT_ORBIT.yaw);
  assert.equal(turned.pitch, DEFAULT_ORBIT.pitch);
  assert.equal(turned.distance, DEFAULT_ORBIT.distance);
  assert.ok(Math.abs(degrees(orbitBy(DEFAULT_ORBIT, 0, 100000).pitch) - 85) < 1e-9);
  assert.ok(Math.abs(degrees(orbitBy(DEFAULT_ORBIT, 0, -100000).pitch) - 5) < 1e-9);
  const tilted = orbitBy(DEFAULT_ORBIT, 0, 20);
  assert.ok(tilted.pitch > DEFAULT_ORBIT.pitch && degrees(tilted.pitch) < 85);
});

test('zoom is clamped between 25 and 120', () => {
  assert.equal(zoomBy(DEFAULT_ORBIT, 1000).distance, 120);
  assert.equal(zoomBy(DEFAULT_ORBIT, 0.001).distance, 25);
  assert.equal(zoomBy({ ...DEFAULT_ORBIT, distance: 50 }, 1.2).distance, 60);
});

test('the camera looks from distance away at the given height', () => {
  const orbit = { yaw: 0.7, pitch: 0.4, distance: 50 };
  const [x, y, z] = cameraPosition(orbit, 10);
  assert.ok(Math.abs(Math.hypot(x, y - 10, z) - 50) < 1e-9);
  assert.ok(Math.abs(Math.asin((y - 10) / 50) - 0.4) < 1e-9);
  // Straight in front at yaw 0, so turning the yaw swings the camera around the tower
  const [x0, , z0] = cameraPosition({ ...orbit, yaw: 0 }, 10);
  assert.ok(Math.abs(x0) < 1e-9 && z0 > 0);
});
