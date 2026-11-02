// Where each hole of the star is drawn: pointy-top hexagonal layout, y down, turned so the viewer's start point is at the bottom
import type { GameState, Hole, Seat } from '../types.ts';

const SQRT3 = Math.sqrt(3);

// The six tips are 12 units from the center at every turn, so this square holds the whole star with room for a marble
export const VIEW_RADIUS = 13.2;
export const VIEW_BOX = `${-VIEW_RADIUS} ${-VIEW_RADIUS} ${2 * VIEW_RADIUS} ${2 * VIEW_RADIUS}`;

// Sixths of a turn that bring the viewer's start point to the bottom; a spectator or a seat without a point sees it unturned
export function turnsFor(points: GameState['points'], viewer: Seat | null): number {
  return viewer === null ? 0 : points[viewer] ?? 0;
}

// Point p sits p sixths clockwise from the bottom, so the board turns p sixths counterclockwise
export function holeXY({ q, r }: Hole, turns: number): { x: number; y: number } {
  const x = SQRT3 * (q + r / 2);
  const y = 1.5 * r;
  const angle = (-turns * Math.PI) / 3;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}
