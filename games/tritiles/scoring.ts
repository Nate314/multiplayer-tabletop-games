// Tri-Tiles scoring: what a play earns and what a finished round pays
import type { Seat } from '../../shared/types.ts';
import { hexagonsCompleted, isBridge } from './grid.ts';
import type { Board, Cell } from './grid.ts';
import { isTriple, tileSum } from './tiles.ts';

export type Bonuses = { hexagon: boolean; bridge: boolean };
export type PlayScore = { points: number; lines: { label: string; points: number }[] };

export const DRAW_PENALTY = 5;
export const MAX_DRAWS = 3;
export const STUCK_PENALTY = 10;
export const GOING_OUT_BONUS = 25;
const TRIPLE_BONUS = 10;
const ZERO_TRIPLE = 40;
const HEXAGON_POINTS = 50;
const BRIDGE_POINTS = 40;

const total = (lines: PlayScore['lines']): PlayScore => ({ points: lines.reduce((sum, line) => sum + line.points, 0), lines });

export function openingScore(tile: number): PlayScore {
  if (!isTriple(tile)) return total([{ label: 'Tile', points: tileSum(tile) }]);
  return total([{ label: 'Triple', points: tileSum(tile) === 0 ? ZERO_TRIPLE : tileSum(tile) + TRIPLE_BONUS }]);
}

// `board` is the board before the tile is placed on `cell`
export function playScore(board: Board, cell: Cell, tile: number, bonuses: Bonuses): PlayScore {
  const lines = [{ label: 'Tile', points: tileSum(tile) }];
  const hexagons = bonuses.hexagon ? hexagonsCompleted(board, cell) : 0;
  if (hexagons > 0) lines.push({ label: hexagons === 1 ? 'Hexagon' : `${hexagons} hexagons`, points: hexagons * HEXAGON_POINTS });
  if (bonuses.bridge && isBridge(board, cell)) lines.push({ label: 'Bridge', points: BRIDGE_POINTS });
  return total(lines);
}

// Points each seat gains; `wentOut` null means the round was blocked
export function roundEndScores(hands: Record<Seat, number[]>, wentOut: Seat | null): Record<Seat, number> {
  const sums = Object.entries(hands).map(([seat, hand]) => [Number(seat), hand.reduce((sum, tile) => sum + tileSum(tile), 0)] as const);
  const gains: Record<Seat, number> = {};
  for (const [seat] of sums) gains[seat] = 0;
  if (wentOut !== null) {
    gains[wentOut] = GOING_OUT_BONUS + sums.filter(([seat]) => seat !== wentOut).reduce((sum, [, s]) => sum + s, 0);
    return gains;
  }
  const lowest = Math.min(...sums.map(([, s]) => s));
  const holders = sums.filter(([, s]) => s === lowest);
  if (holders.length === 1) gains[holders[0][0]] = sums.reduce((sum, [, s]) => sum + s - lowest, 0);
  return gains;
}
