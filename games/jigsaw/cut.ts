import type { Random } from '../../shared/types.ts';
import { PICTURE_W, PICTURE_H } from './pictures.ts';

export type PieceCount = 24 | 48 | 96 | 150;
export const GRIDS: Record<PieceCount, { cols: number; rows: number }> = {
  24: { cols: 6, rows: 4 },
  48: { cols: 8, rows: 6 },
  96: { cols: 12, rows: 8 },
  150: { cols: 15, rows: 10 },
};

export const TABLE_W = 2000;
export const TABLE_H = 1800;
export const BOARD_X = 280;
export const BOARD_Y = 80;

export type Grid = { cols: number; rows: number; w: number; h: number };
export type Point = { x: number; y: number };
// +1: a tab out of the piece toward +x or +y; -1: a blank. right[row][col] for col < cols-1, down[row][col] for row < rows-1
export type Edges = { right: number[][]; down: number[][] };

export const SNAP_FRACTION = 0.3;
const TAB_FRACTION = 0.22;
const NECK_START = 0.35;
const NECK_END = 0.65;
const SCATTER_TRIES = 20;

export function gridOf(count: PieceCount): Grid {
  const { cols, rows } = GRIDS[count];
  return { cols, rows, w: PICTURE_W / cols, h: PICTURE_H / rows };
}

export function homeOf(grid: Grid, piece: number): Point {
  return {
    x: BOARD_X + (piece % grid.cols) * grid.w,
    y: BOARD_Y + Math.floor(piece / grid.cols) * grid.h,
  };
}

function mulberry32(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function edgesOf(seed: number, grid: Grid): Edges {
  const random = mulberry32(seed);
  const sign = () => (random() < 0.5 ? 1 : -1);
  const right = Array.from({ length: grid.rows }, () => Array.from({ length: grid.cols - 1 }, sign));
  const down = Array.from({ length: grid.rows - 1 }, () => Array.from({ length: grid.cols }, sign));
  return { right, down };
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

// One side from a to b. normal is the outward unit normal; sign 0 is flat.
function side(a: Point, b: Point, normal: Point, sign: number, tab: number): string {
  const end = `L ${fmt(b.x)} ${fmt(b.y)}`;
  if (sign === 0) return end;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const at = (along: number, out: number): Point => ({
    x: a.x + dx * along + normal.x * out * sign * tab,
    y: a.y + dy * along + normal.y * out * sign * tab,
  });
  const p = (q: Point) => `${fmt(q.x)} ${fmt(q.y)}`;
  const neck1 = at(NECK_START, 0);
  const neck2 = at(NECK_END, 0);
  return [
    `L ${p(neck1)}`,
    `C ${p(at(NECK_START - 0.08, 0.5))} ${p(at(0.38, 1))} ${p(at(0.5, 1))}`,
    `C ${p(at(0.62, 1))} ${p(at(NECK_END + 0.08, 0.5))} ${p(neck2)}`,
    end,
  ].join(' ');
}

export function piecePath(grid: Grid, edges: Edges, piece: number): string {
  const col = piece % grid.cols;
  const row = Math.floor(piece / grid.cols);
  const { w, h } = grid;
  const tab = TAB_FRACTION * Math.min(w, h);
  const top = row > 0 ? -edges.down[row - 1][col] : 0;
  const rightSide = col < grid.cols - 1 ? edges.right[row][col] : 0;
  const bottom = row < grid.rows - 1 ? edges.down[row][col] : 0;
  const left = col > 0 ? -edges.right[row][col - 1] : 0;
  return [
    'M 0 0',
    side({ x: 0, y: 0 }, { x: w, y: 0 }, { x: 0, y: -1 }, top, tab),
    side({ x: w, y: 0 }, { x: w, y: h }, { x: 1, y: 0 }, rightSide, tab),
    side({ x: w, y: h }, { x: 0, y: h }, { x: 0, y: 1 }, bottom, tab),
    side({ x: 0, y: h }, { x: 0, y: 0 }, { x: -1, y: 0 }, left, tab),
    'Z',
  ].join(' ');
}

export function snaps(grid: Grid, piece: number, x: number, y: number): boolean {
  const home = homeOf(grid, piece);
  return Math.hypot(x - home.x, y - home.y) <= SNAP_FRACTION * Math.min(grid.w, grid.h);
}

export function clampToTable(grid: Grid, x: number, y: number): Point {
  return {
    x: Math.round(Math.min(Math.max(x, 0), TABLE_W - grid.w)),
    y: Math.round(Math.min(Math.max(y, 0), TABLE_H - grid.h)),
  };
}

export function scatter(grid: Grid, random: Random): Point[] {
  const margin = TAB_FRACTION * Math.min(grid.w, grid.h);
  const offBoard = (p: Point) =>
    p.x + grid.w <= BOARD_X - margin || p.x >= BOARD_X + PICTURE_W + margin
    || p.y + grid.h <= BOARD_Y - margin || p.y >= BOARD_Y + PICTURE_H + margin;
  const spots: Point[] = [];
  for (let i = 0; i < grid.cols * grid.rows; i++) {
    let spot: Point = { x: 0, y: 0 };
    for (let tries = 0; tries < SCATTER_TRIES; tries++) {
      spot = {
        x: Math.floor(random() * (TABLE_W - grid.w + 1)),
        y: Math.floor(random() * (TABLE_H - grid.h + 1)),
      };
      if (offBoard(spot)) break;
    }
    spots.push(spot);
  }
  return spots;
}
