import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ORBIT, cameraPosition, dragView, orbitBy, spinSpeed, tiltBy, zoomBy } from './orbit.ts';
import { MAX_SPIN } from '../physics.ts';

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

test('tilting changes only the pitch, within 5 to 85 degrees', () => {
  const tilted = tiltBy(DEFAULT_ORBIT, 20);
  assert.ok(tilted.pitch > DEFAULT_ORBIT.pitch && degrees(tilted.pitch) < 85);
  assert.equal(tilted.yaw, DEFAULT_ORBIT.yaw);
  assert.equal(tilted.distance, DEFAULT_ORBIT.distance);
  assert.ok(Math.abs(degrees(tiltBy(DEFAULT_ORBIT, 100000).pitch) - 85) < 1e-9);
  assert.ok(Math.abs(degrees(tiltBy(DEFAULT_ORBIT, -100000).pitch) - 5) < 1e-9);
});

test('a drag right spins the turntable right, capped at MAX_SPIN', () => {
  assert.ok(Math.abs(spinSpeed(10, 50) - 1.6) < 1e-9);
  assert.ok(Math.abs(spinSpeed(-10, 50) + 1.6) < 1e-9);
  assert.equal(spinSpeed(1000, 50), MAX_SPIN);
  assert.equal(spinSpeed(10, 0), 0);
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

test('while the turntable turns, dragging the view tilts it but never swings it round', () => {
  const dragged = dragView(DEFAULT_ORBIT, 100, 20, true);
  assert.equal(dragged.yaw, DEFAULT_ORBIT.yaw);
  assert.deepEqual(dragged, tiltBy(DEFAULT_ORBIT, 20));
  assert.deepEqual(dragView(DEFAULT_ORBIT, 100, 20, false), orbitBy(DEFAULT_ORBIT, 100, 20));
});
