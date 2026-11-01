// The 121-hole star in axial coordinates (q to the right, r downward, s = -q - r): pure geometry, no game state.
// The star is two overlapping triangles, so a hole is in one of them; the 61 holes in both are the center.
import type { Hole, PointIndex } from './types.ts';

const SIZE = 4; // the center hexagon reaches 4 holes from the middle; the points reach 4 more

export function holeKey({ q, r }: Hole): string {
  return `${q},${r}`;
}

export function parseHole(key: string): Hole {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

const sOf = ({ q, r }: Hole): number => -q - r;

export function isHole(hole: Hole): boolean {
  const coords = [hole.q, hole.r, sOf(hole)];
  return Math.min(...coords) >= -SIZE || Math.max(...coords) <= SIZE;
}

const SPAN = 2 * SIZE;

export const HOLES: Hole[] = Array.from({ length: 2 * SPAN + 1 }, (_, row) => row - SPAN).flatMap(r =>
  Array.from({ length: 2 * SPAN + 1 }, (_, col) => ({ q: col - SPAN, r })).filter(isHole)
);

export const DIRECTIONS: Hole[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
];

export function neighbors(hole: Hole): Hole[] {
  return DIRECTIONS.map(({ q, r }) => ({ q: hole.q + q, r: hole.r + r })).filter(isHole);
}

export function pointOf(hole: Hole): PointIndex | null {
  const s = sOf(hole);
  if (hole.r > SIZE) return 0;
  if (hole.q < -SIZE) return 1;
  if (s > SIZE) return 2;
  if (hole.r < -SIZE) return 3;
  if (hole.q > SIZE) return 4;
  if (s < -SIZE) return 5;
  return null;
}

const POINTS: PointIndex[] = [0, 1, 2, 3, 4, 5];

export const POINT_HOLES = Object.fromEntries(
  POINTS.map(point => [point, HOLES.filter(hole => pointOf(hole) === point)])
) as Record<PointIndex, Hole[]>;

export function opposite(point: PointIndex): PointIndex {
  return ((point + 3) % 6) as PointIndex;
}

// The start points for each table size that can play (Wikipedia); five cannot, as one player would face nobody
export const START_POINTS: Record<2 | 3 | 4 | 6, PointIndex[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  6: [0, 1, 2, 3, 4, 5]
};

export const PLAYABLE_COUNTS = [2, 3, 4, 6];
