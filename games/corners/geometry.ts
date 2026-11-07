export type BoardKind = 'squares' | 'triangles';
export type Cell = readonly [x: number, y: number, t: 0 | 1];
export type Shape = Cell[];

export const BOARD_SIZE = 20;
export const HEX_SIDE = 9;

type Point = readonly [number, number];

export const cellKey = (c: Cell): string => `${c[0]},${c[1]},${c[2]}`;

const pointList = (kind: BoardKind, [x, y, t]: Cell): Point[] =>
  kind === 'squares'
    ? [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]
    : t === 0
      ? [[x, y], [x + 1, y], [x, y + 1]]
      : [[x + 1, y], [x, y + 1], [x + 1, y + 1]];

export const corners = (kind: BoardKind, cell: Cell): string[] =>
  pointList(kind, cell).map(([x, y]) => `${x},${y}`);

const cellFromPoints = (kind: BoardKind, pts: Point[]): Cell => {
  const a = Math.min(...pts.map((p) => p[0]));
  const b = Math.min(...pts.map((p) => p[1]));
  if (kind === 'squares') return [a, b, 0];
  return [a, b, pts.some((p) => p[0] === a && p[1] === b) ? 0 : 1];
};

const SYMMETRY: Record<BoardKind, { rotate: (p: Point) => Point; mirror: (p: Point) => Point; turns: number }> = {
  squares: { rotate: ([x, y]) => [-y, x], mirror: ([x, y]) => [-x, y], turns: 4 },
  triangles: { rotate: ([x, y]) => [-y, x + y], mirror: ([x, y]) => [y, x], turns: 6 }
};

const compare = (p: Cell, q: Cell): number => p[0] - q[0] || p[1] - q[1] || p[2] - q[2];

export function normalize(shape: Shape): Shape {
  const dx = Math.min(...shape.map((c) => c[0]));
  const dy = Math.min(...shape.map((c) => c[1]));
  return shape.map((c): Cell => [c[0] - dx, c[1] - dy, c[2]]).sort(compare);
}

const shapeKey = (shape: Shape): string => shape.map(cellKey).join(';');

export function orientations(kind: BoardKind, shape: Shape): Shape[] {
  const { rotate, mirror, turns } = SYMMETRY[kind];
  const seen = new Map<string, Shape>();
  let pts = shape.map((c) => pointList(kind, c));
  for (let flip = 0; flip < 2; flip++) {
    for (let r = 0; r < turns; r++) {
      const s = normalize(pts.map((p) => cellFromPoints(kind, p as Point[])));
      seen.set(shapeKey(s), s);
      pts = pts.map((p) => p.map(rotate));
    }
    pts = pts.map((p) => p.map(mirror));
  }
  return [...seen.values()];
}

export const canonical = (kind: BoardKind, shape: Shape): string =>
  orientations(kind, shape).map(shapeKey).sort()[0];

export function boardCells(kind: BoardKind): Cell[] {
  const out: Cell[] = [];
  if (kind === 'squares') {
    for (let x = 0; x < BOARD_SIZE; x++) for (let y = 0; y < BOARD_SIZE; y++) out.push([x, y, 0]);
    return out;
  }
  const inHex = ([x, y]: Point): boolean => Math.max(Math.abs(x), Math.abs(y), Math.abs(x + y)) <= HEX_SIDE;
  for (let a = -HEX_SIDE - 1; a <= HEX_SIDE; a++) {
    for (let b = -HEX_SIDE - 1; b <= HEX_SIDE; b++) {
      for (const t of [0, 1] as const) {
        if (pointList(kind, [a, b, t]).every(inHex)) out.push([a, b, t]);
      }
    }
  }
  return out;
}

const sharedCorners = (kind: BoardKind, a: Cell, b: Cell): number => {
  const mine = new Set(corners(kind, a));
  return corners(kind, b).filter((k) => mine.has(k)).length;
};

export const edgeTouch = (kind: BoardKind, a: Cell, b: Cell): boolean => sharedCorners(kind, a, b) === 2;
export const cornerTouch = (kind: BoardKind, a: Cell, b: Cell): boolean => sharedCorners(kind, a, b) === 1;

function generatePieces(kind: BoardKind, maxSize: number): Shape[] {
  const ts: (0 | 1)[] = kind === 'squares' ? [0] : [0, 1];
  let level = new Map<string, Shape>([[canonical(kind, [[0, 0, 0]]), [[0, 0, 0]]]]);
  const all: [string, Shape][] = [...level];
  for (let size = 2; size <= maxSize; size++) {
    const next = new Map<string, Shape>();
    for (const shape of level.values()) {
      const have = new Set(shape.map(cellKey));
      for (const c of shape) {
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const t of ts) {
          const n: Cell = [c[0] + dx, c[1] + dy, t];
          if (have.has(cellKey(n)) || !edgeTouch(kind, c, n)) continue;
          const grown = normalize([...shape, n]);
          const key = canonical(kind, grown);
          if (!next.has(key)) next.set(key, grown);
        }
      }
    }
    all.push(...next);
    level = next;
  }
  return all
    .sort((p, q) => p[1].length - q[1].length || (p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0))
    .map(([, s]) => s);
}

export const PIECES: Record<BoardKind, Shape[]> = {
  squares: generatePieces('squares', 5),
  triangles: generatePieces('triangles', 6)
};

export const SQUARE_STARTS: Cell[] = [[0, 0, 0], [19, 0, 0], [19, 19, 0], [0, 19, 0]];

const D: Point[] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

export const TRIANGLE_STARTS: Cell[] = D.map((d, k) => {
  const s: Point = [6 * d[0], 6 * d[1]];
  const e = D[(k + 2) % 6];
  return cellFromPoints('triangles', [s, [s[0] - d[0], s[1] - d[1]], [s[0] + e[0], s[1] + e[1]]]);
});
