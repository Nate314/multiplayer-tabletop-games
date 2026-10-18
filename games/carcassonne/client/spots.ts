// Where things sit on a tile drawn 100 units square, as the tile is printed (before it is turned):
// a meeple's spot on each feature, and the pennant
import type { FeatureRef, TileType } from '../types.ts';

export type Point = { x: number; y: number };

type TileSpots = { city?: Point[]; road?: Point[]; field: Point[]; monastery?: Point; pennant?: Point };

const p = (x: number, y: number): Point => ({ x, y });

export const SPOTS: Record<TileType, TileSpots> = {
  A: { monastery: p(50, 46), road: [p(50, 84)], field: [p(18, 20)] },
  B: { monastery: p(50, 46), field: [p(18, 20)] },
  C: { city: [p(50, 50)], field: [], pennant: p(24, 24) },
  D: { city: [p(50, 13)], road: [p(72, 50)], field: [p(26, 38), p(50, 78)] },
  E: { city: [p(50, 13)], field: [p(50, 66)] },
  F: { city: [p(50, 50)], field: [p(50, 13), p(50, 87)], pennant: p(18, 50) },
  G: { city: [p(50, 50)], field: [p(50, 13), p(50, 87)] },
  H: { city: [p(87, 50), p(13, 50)], field: [p(50, 50)] },
  I: { city: [p(50, 13), p(87, 50)], field: [p(38, 62)] },
  J: { city: [p(50, 13)], road: [p(63, 63)], field: [p(86, 86), p(26, 58)] },
  K: { city: [p(50, 13)], road: [p(37, 63)], field: [p(14, 86), p(74, 58)] },
  L: { city: [p(50, 13)], road: [p(82, 50), p(50, 82), p(18, 50)], field: [p(74, 36), p(78, 78), p(22, 78)] },
  M: { city: [p(28, 28)], field: [p(70, 70)], pennant: p(56, 14) },
  N: { city: [p(28, 28)], field: [p(70, 70)] },
  O: { city: [p(20, 20)], road: [p(64, 64)], field: [p(86, 86), p(82, 26)], pennant: p(12, 46) },
  P: { city: [p(20, 20)], road: [p(64, 64)], field: [p(86, 86), p(82, 26)] },
  Q: { city: [p(50, 32)], field: [p(50, 87)], pennant: p(20, 18) },
  R: { city: [p(50, 32)], field: [p(50, 87)] },
  S: { city: [p(50, 30)], road: [p(50, 85)], field: [p(84, 88), p(16, 88)], pennant: p(20, 18) },
  T: { city: [p(50, 30)], road: [p(50, 85)], field: [p(84, 88), p(16, 88)] },
  U: { road: [p(50, 50)], field: [p(78, 30), p(22, 70)] },
  V: { road: [p(37, 63)], field: [p(14, 86), p(70, 30)] },
  W: { road: [p(82, 50), p(50, 82), p(18, 50)], field: [p(50, 22), p(78, 78), p(22, 78)] },
  X: { road: [p(50, 20), p(82, 50), p(50, 82), p(18, 50)], field: [p(78, 22), p(78, 78), p(22, 78), p(22, 22)] }
};

// A point on a tile turned `rotation` quarter turns clockwise about its center
export function turnPoint({ x, y }: Point, rotation: number): Point {
  let point = { x, y };
  for (let turn = 0; turn < ((rotation % 4) + 4) % 4; turn++) point = { x: 100 - point.y, y: point.x };
  return point;
}

// The spot for a meeple on a feature of a turned tile
export function spotOf(type: TileType, rotation: number, feature: FeatureRef): Point {
  const spots = SPOTS[type];
  const point = feature.kind === 'monastery' ? spots.monastery : spots[feature.kind]?.[feature.index];
  return turnPoint(point ?? p(50, 50), rotation);
}
