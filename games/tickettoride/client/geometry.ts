// Where each train space of a route is drawn on the map: evenly along the line (or curve) between its two cities,
// with the two tracks of a double route side by side
import { CITIES } from '../map.ts';
import type { Route } from '../types.ts';

export { MAP_LEFT, MAP_WIDTH, MAP_HEIGHT } from '../map.ts';
export const CITY_RADIUS = 7;
export const TRACK_WIDTH = 9;
const TRACK_GAP = 3;          // between train spaces
const CITY_CLEARANCE = 11;    // from a city's center to the first space
const TWIN_OFFSET = 6;        // from the center line to each track of a double route
const SAMPLES = 48;

export type Space = { x: number; y: number; angle: number; length: number };

type Point = { x: number; y: number };

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// A quadratic curve through the control point, or a straight line when there is none
function curve(route: Route): (t: number) => Point {
  const a = CITIES[route.a];
  const b = CITIES[route.b];
  const control = route.via ? { x: route.via[0], y: route.via[1] } : lerp(a, b, 0.5);
  // The lower id of a double route goes on one side of the center line, its twin on the other
  const side = route.twin === null ? 0 : route.id < route.twin ? -1 : 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const norm = Math.hypot(dx, dy) || 1;
  const shift = { x: (-dy / norm) * TWIN_OFFSET * side, y: (dx / norm) * TWIN_OFFSET * side };
  const [p0, p1, p2] = [a, control, b].map(point => ({ x: point.x + shift.x, y: point.y + shift.y }));
  return t => lerp(lerp(p0, p1, t), lerp(p1, p2, t), t);
}

export function routeSpaces(route: Route): Space[] {
  const at = curve(route);
  const points = Array.from({ length: SAMPLES + 1 }, (_, index) => at(index / SAMPLES));
  const distances = [0];
  for (let i = 1; i < points.length; i++) {
    distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const total = distances[distances.length - 1];
  // The point and direction at a distance along the curve
  const along = (distance: number): Space => {
    const index = Math.max(1, distances.findIndex(value => value >= distance));
    const [from, to] = [points[index - 1], points[index]];
    const span = distances[index] - distances[index - 1] || 1;
    const point = lerp(from, to, (distance - distances[index - 1]) / span);
    return { ...point, angle: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI, length: 0 };
  };
  const usable = total - 2 * CITY_CLEARANCE;
  const length = Math.max(4, (usable - TRACK_GAP * (route.length - 1)) / route.length);
  return Array.from({ length: route.length }, (_, index) => ({
    ...along(CITY_CLEARANCE + index * (length + TRACK_GAP) + length / 2),
    length
  }));
}

// Where a city's name sits relative to its dot
export function labelPlacement(label: 'left' | 'right' | 'above' | 'below' = 'below'): { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' } {
  switch (label) {
    case 'left': return { dx: -11, dy: 4, anchor: 'end' };
    case 'right': return { dx: 11, dy: 4, anchor: 'start' };
    case 'above': return { dx: 0, dy: -11, anchor: 'middle' };
    case 'below': return { dx: 0, dy: 19, anchor: 'middle' };
  }
}
