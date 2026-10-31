// The orbit camera's maths, kept free of three so it runs under node:test; rendering only, never fed to the physics
import { MAX_SPIN } from '../physics.ts';
import type { Vec3 } from '../types.ts';

export type Orbit = { yaw: number; pitch: number; distance: number };

const DEGREE = Math.PI / 180;
const MIN_PITCH = 5 * DEGREE;
const MAX_PITCH = 85 * DEGREE;
const MIN_DISTANCE = 25;
const MAX_DISTANCE = 120;
// Radians per pixel dragged
const TURN_SPEED = 0.008;

export const DEFAULT_ORBIT: Orbit = { yaw: 35 * DEGREE, pitch: 20 * DEGREE, distance: 60 };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export const tiltBy = (o: Orbit, dyPx: number): Orbit => ({ ...o, pitch: clamp(o.pitch + dyPx * TURN_SPEED, MIN_PITCH, MAX_PITCH) });

export const orbitBy = (o: Orbit, dxPx: number, dyPx: number): Orbit => tiltBy({ ...o, yaw: o.yaw + dxPx * TURN_SPEED }, dyPx);

// The turntable turns as fast as an orbit drag would have swung the camera, so the near face follows the finger
export const spinSpeed = (dxPx: number, dtMs: number) =>
  dtMs <= 0 ? 0 : clamp(dxPx / (dtMs / 1000) * TURN_SPEED, -MAX_SPIN, MAX_SPIN);

export const zoomBy = (o: Orbit, factor: number): Orbit => ({ ...o, distance: clamp(o.distance * factor, MIN_DISTANCE, MAX_DISTANCE) });

export function cameraPosition(o: Orbit, lookY: number): Vec3 {
  const flat = o.distance * Math.cos(o.pitch);
  return [flat * Math.sin(o.yaw), lookY + o.distance * Math.sin(o.pitch), flat * Math.cos(o.yaw)];
}
