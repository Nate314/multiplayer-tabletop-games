import { bankOf } from '../rules.ts';

// A loose sunflower cluster: stones spiral out from the middle of the hole by the golden angle, so neighbors never stack.
// Small piles keep the spacing of `loose` stones; bigger ones pack the same area with smaller stones.
type Shape = {
  most: number; // drawn one by one up to this many; the count label stays exact past it
  loose: number;
  rx: number; // the cluster's radii, as fractions of the hole's width and height
  ry: number;
  cy: number;
  maxSize: number; // a stone's largest diameter, as a fraction of the hole's width
};

const SHAPES: Record<'pit' | 'bank', Shape> = {
  pit: { most: 18, loose: 5, rx: 0.32, ry: 0.32, cy: 0.5, maxSize: 0.24 },
  // A bank is about 1.7 times as tall as it is wide, and leaves room for its count at the top
  bank: { most: 48, loose: 10, rx: 0.3, ry: 0.32, cy: 0.56, maxSize: 0.2 }
};
const BANK_ASPECT = 1.7;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function shapeOf(hole: number): Shape {
  return hole === bankOf(1) || hole === bankOf(2) ? SHAPES.bank : SHAPES.pit;
}

// How many of a hole's stones are drawn
export function drawnCount(hole: number, count: number): number {
  return Math.min(count, shapeOf(hole).most);
}

// The center of stone `index` of the `count` in `hole`, and its diameter, as fractions of the hole's width and height
export function stoneSpot(hole: number, index: number, count: number): { x: number; y: number; size: number } {
  const shape = shapeOf(hole);
  const spread = Math.max(drawnCount(hole, count), shape.loose);
  const radius = Math.sqrt((index + 0.5) / spread);
  const angle = index * GOLDEN_ANGLE;
  const area = Math.PI * shape.rx * shape.ry * (shape === SHAPES.bank ? BANK_ASPECT : 1);
  return {
    x: 0.5 + radius * Math.cos(angle) * shape.rx,
    y: shape.cy + radius * Math.sin(angle) * shape.ry,
    size: Math.min(shape.maxSize, 0.95 * Math.sqrt(area / spread))
  };
}
