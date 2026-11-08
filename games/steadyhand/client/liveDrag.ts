// The dragger's side of the live drag: throttling, the wall check and what each viewer draws
import { SIMULATION_TICK_MS } from '../../../shared/gameDefinition.ts';
import { checkStep } from '../geometry.ts';
import type { Live, Part, Point, Seat } from '../types.ts';

// The board's viewBox; the server refuses a point outside it
export const BAY_WIDTH = 1000;
export const BAY_HEIGHT = 640;

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));

// At most 20 drags a second
export const shouldSend = (lastSentMs: number, nowMs: number): boolean => nowMs - lastSentMs >= SIMULATION_TICK_MS;

// Checks the whole segment from the last checked point, clamped into the bay so a pointer leaving it buzzes on the wall
export function stepDrag(part: Part, from: Point, to: Point, factor: number): { at: Point; result: 'inside' | 'buzz' | 'out' } {
  const at: Point = [clamp(to[0], BAY_WIDTH), clamp(to[1], BAY_HEIGHT)];
  return { at, result: checkStep(part, from, at, factor) };
}

// The dragger draws their own pointer, so an older echo never pulls the part back; everyone else draws the stream
export function drawnPosition(live: Live | null, me: Seat, local: Point | null): Point | null {
  if (!live) return null;
  return live.seat === me ? local : live.at;
}

// The part whose rest spot is nearest the press, within `radius` board units
export function partAt(parts: Part[], [x, y]: Point, radius: number): Part | undefined {
  let best: Part | undefined;
  let bestDistance = radius;
  for (const part of parts) {
    const distance = Math.hypot(part.path[0][0] - x, part.path[0][1] - y);
    if (distance <= bestDistance) [best, bestDistance] = [part, distance];
  }
  return best;
}
