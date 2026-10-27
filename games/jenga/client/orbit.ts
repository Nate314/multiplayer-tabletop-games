// The orbit camera's maths, kept free of three so it runs under node:test; rendering only, never fed to the physics
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

export const orbitBy = (o: Orbit, dxPx: number, dyPx: number): Orbit =>
  ({ ...o, yaw: o.yaw + dxPx * TURN_SPEED, pitch: clamp(o.pitch + dyPx * TURN_SPEED, MIN_PITCH, MAX_PITCH) });

export const zoomBy = (o: Orbit, factor: number): Orbit => ({ ...o, distance: clamp(o.distance * factor, MIN_DISTANCE, MAX_DISTANCE) });

export function cameraPosition(o: Orbit, lookY: number): Vec3 {
  const flat = o.distance * Math.cos(o.pitch);
  return [flat * Math.sin(o.yaw), lookY + o.distance * Math.sin(o.pitch), flat * Math.cos(o.yaw)];
}
