export type ShapeId = string;

// `period` is the fewest 45 degree turns after which the shape looks the same: 1 round, 2 square-like, 4 half-turn only, 8 none
export const SHAPES: { id: ShapeId; label: string; period: 1 | 2 | 4 | 8; path: string }[] = [
  { id: 'circle', label: 'Circle', period: 1, path: 'M50 5 A45 45 0 1 1 50 95 A45 45 0 1 1 50 5 Z' },
  { id: 'octagon', label: 'Octagon', period: 1, path: polygon(regular(8, 45, -67.5)) },
  { id: 'square', label: 'Square', period: 2, path: polygon([[12, 12], [88, 12], [88, 88], [12, 88]]) },
  { id: 'plus', label: 'Plus', period: 2, path: polygon([[36, 8], [64, 8], [64, 36], [92, 36], [92, 64], [64, 64], [64, 92], [36, 92], [36, 64], [8, 64], [8, 36], [36, 36]]) },
  { id: 'star4', label: 'Four point star', period: 2, path: polygon(star(4, 46, 15)) },
  { id: 'hexagon', label: 'Hexagon', period: 4, path: polygon(regular(6, 46, 0)) },
  { id: 'star6', label: 'Six point star', period: 4, path: polygon(star(6, 46, 26)) },
  { id: 'diamond', label: 'Diamond', period: 4, path: polygon([[50, 5], [75, 50], [50, 95], [25, 50]]) },
  { id: 'parallelogram', label: 'Parallelogram', period: 4, path: polygon([[30, 25], [94, 25], [70, 75], [6, 75]]) },
  { id: 'oval', label: 'Oval', period: 4, path: 'M5 50 A45 28 0 1 1 95 50 A45 28 0 1 1 5 50 Z' },
  { id: 'triangle', label: 'Triangle', period: 8, path: polygon(regular(3, 48, -90)) },
  { id: 'pentagon', label: 'Pentagon', period: 8, path: polygon(regular(5, 46, -90)) },
  { id: 'star5', label: 'Five point star', period: 8, path: polygon(star(5, 48, 20)) },
  { id: 'heart', label: 'Heart', period: 8, path: 'M50 90 C10 60 5 30 25 18 C38 10 48 18 50 28 C52 18 62 10 75 18 C95 30 90 60 50 90 Z' },
  // Outer circle minus an offset circle; the arc ends are their two intersections
  { id: 'crescent', label: 'Crescent', period: 8, path: 'M75.14 12.68 A45 45 0 1 0 75.14 87.32 A38 38 0 1 1 75.14 12.68 Z' },
  { id: 'arrow', label: 'Arrow', period: 8, path: polygon([[50, 6], [88, 46], [65, 46], [65, 94], [35, 94], [35, 46], [12, 46]]) },
  { id: 'bolt', label: 'Lightning bolt', period: 8, path: polygon([[62, 5], [25, 54], [46, 54], [36, 95], [78, 42], [55, 42], [72, 5]]) },
  { id: 'kite', label: 'Kite', period: 8, path: polygon([[50, 5], [80, 38], [50, 95], [20, 38]]) },
  { id: 'trapezoid', label: 'Trapezoid', period: 8, path: polygon([[28, 25], [72, 25], [92, 75], [8, 75]]) },
  { id: 'semicircle', label: 'Semicircle', period: 8, path: 'M5 70 A45 45 0 0 1 95 70 Z' },
  { id: 'teardrop', label: 'Teardrop', period: 8, path: 'M50 5 C60 25 82 40 82 62 A32 32 0 1 1 18 62 C18 40 40 25 50 5 Z' },
  { id: 'house', label: 'House', period: 8, path: polygon([[50, 8], [92, 45], [80, 45], [80, 92], [20, 92], [20, 45], [8, 45]]) },
  { id: 'ell', label: 'L shape', period: 8, path: polygon([[22, 8], [48, 8], [48, 66], [86, 66], [86, 92], [22, 92]]) },
  { id: 'tee', label: 'T shape', period: 8, path: polygon([[8, 10], [92, 10], [92, 34], [62, 34], [62, 92], [38, 92], [38, 34], [8, 34]]) },
  { id: 'chevron', label: 'Chevron', period: 8, path: polygon([[8, 20], [32, 20], [50, 58], [68, 20], [92, 20], [50, 92]]) }
];

export const shapeLabel = (id: ShapeId): string => SHAPES.find((s) => s.id === id)?.label ?? id;

type Point = [number, number];

function polygon(points: Point[]): string {
  return `M${points.map(([x, y]) => `${x} ${y}`).join(' L')} Z`;
}

function onCircle(radius: number, degrees: number): Point {
  const a = (degrees * Math.PI) / 180;
  return [+(50 + radius * Math.cos(a)).toFixed(2), +(50 + radius * Math.sin(a)).toFixed(2)];
}

// Regular polygon with its first vertex at `start` degrees; vertex angles are exact multiples of 360/sides
function regular(sides: number, radius: number, start: number): Point[] {
  return Array.from({ length: sides }, (_, i) => onCircle(radius, start + (360 * i) / sides));
}

// Star with its first point straight up, inner vertices halfway between points
function star(points: number, outer: number, inner: number): Point[] {
  return Array.from({ length: points * 2 }, (_, i) => onCircle(i % 2 ? inner : outer, -90 + (180 * i) / points));
}
