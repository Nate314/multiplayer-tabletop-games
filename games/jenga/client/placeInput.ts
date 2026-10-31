// Pointer placement input, kept free of three so it runs under node:test; rendering only, never fed to the physics
import { BLOCK, TURNTABLE } from '../physics.ts';
import type { Pose, Slot } from '../types.ts';

// How near, in screen pixels, the dragged block must come to an open spot to snap into it
export const SNAP_PX = 28;
// How far out the held block lies, past the turntable's rim
export const HELD_REST_DISTANCE = 11;

export function snapSlot(pointer: { x: number; y: number }, targets: { slot: Slot; x: number; y: number }[]): Slot | null {
  let best: Slot | null = null;
  let nearest = SNAP_PX;
  for (const target of targets) {
    const distance = Math.hypot(target.x - pointer.x, target.y - pointer.y);
    if (distance <= nearest) {
      nearest = distance;
      best = target.slot;
    }
  }
  return best;
}

// Lying on the ground off the turntable, between it and the camera, broadside so it is easy to press
export const restPose = (cameraYaw: number): Pose => ({
  p: [HELD_REST_DISTANCE * Math.sin(cameraYaw), BLOCK.height / 2 - TURNTABLE.height, HELD_REST_DISTANCE * Math.cos(cameraYaw)],
  q: [0, Math.sin(cameraYaw / 2), 0, Math.cos(cameraYaw / 2)]
});
