import type { SymbolColor } from '../../../src/components/colorSymbols.ts';
import { corners, type BoardKind, type Cell } from '../geometry.ts';

// The color-blind symbol of each color, Blue, Yellow, Red, Green
export const SYMBOLS: SymbolColor[] = ['blue', 'yellow', 'red', 'green'];

const H = Math.sqrt(3) / 2;

// A lattice point on screen: squares as they are, triangle corners on a 60 degree slant
function screenPoint(kind: BoardKind, key: string): [number, number] {
  const [x, y] = key.split(',').map(Number);
  return kind === 'squares' ? [x, y] : [x + y / 2, y * H];
}

export const cellPoints = (kind: BoardKind, cell: Cell): [number, number][] =>
  corners(kind, cell).map(key => screenPoint(kind, key));

export const pointsAttr = (pts: [number, number][]) => pts.map(p => p.join(',')).join(' ');

export const centerOf = (pts: [number, number][]): [number, number] =>
  [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

// The bounding box of some cells, as an SVG viewBox with a margin
export function viewBoxOf(kind: BoardKind, cells: Cell[], margin: number): string {
  const pts = cells.flatMap(c => cellPoints(kind, c));
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const [x0, y0] = [Math.min(...xs) - margin, Math.min(...ys) - margin];
  return `${x0} ${y0} ${Math.max(...xs) + margin - x0} ${Math.max(...ys) + margin - y0}`;
}
