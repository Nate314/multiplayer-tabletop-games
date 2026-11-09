// Slot shapes, shared by the browser (which checks the drag) and the tests; imports nothing from the server
import { EXIT_RADIUS, PART_RADIUS } from './board.ts';
import type { Part, Point } from './types.ts';

const SAMPLE = 2; // board units between checked points along a step

// How far the part's centre may stray from the slot's middle line before it touches a wall
export function clearance(part: Part, factor: number): number {
  return part.width / 2 * factor - PART_RADIUS;
}

function distanceToSegment([px, py]: Point, [ax, ay]: Point, [bx, by]: Point): number {
  const dx = bx - ax, dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function distanceToPath(path: Point[], p: Point): number {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) best = Math.min(best, distanceToSegment(p, path[i - 1], path[i]));
  return best;
}

export function pathLength(path: Point[]): number {
  let length = 0;
  for (let i = 1; i < path.length; i++) length += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return length;
}

// Checks the whole segment, so a fast flick cannot jump over a wall between two pointer events
export function checkStep(part: Part, from: Point, to: Point, factor: number): 'inside' | 'buzz' | 'out' {
  const room = clearance(part, factor);
  const exit = part.path[part.path.length - 1];
  const steps = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / SAMPLE));
  for (let i = 0; i <= steps; i++) {
    const p: Point = [from[0] + (to[0] - from[0]) * i / steps, from[1] + (to[1] - from[1]) * i / steps];
    if (distanceToPath(part.path, p) > room) return 'buzz';
    if (Math.hypot(p[0] - exit[0], p[1] - exit[1]) <= EXIT_RADIUS) return 'out';
  }
  return 'inside';
}
