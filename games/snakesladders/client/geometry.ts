// Where things sit on the board, in board units of a 0 0 100 100 viewBox: pure, so it is tested without a browser
import { cellOf } from '../board.ts';
import type { LastMove } from '../types.ts';

export const CELL = 10;
const STACK_COLUMNS = 3;
const STACK_GAP = 3; // between token centers in a shared square: 3 columns span -3 to 3, 2 rows -1.5 to 1.5

export function centerOf(square: number): { x: number; y: number } {
  const { row, col } = cellOf(square);
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

// The index-th of `count` tokens on one square, in a grid of up to 3 columns and 2 rows centered in the cell
export function stackOffset(index: number, count: number): { dx: number; dy: number } {
  const columns = Math.min(count, STACK_COLUMNS);
  const rows = Math.ceil(count / STACK_COLUMNS);
  const col = index % STACK_COLUMNS;
  const row = Math.floor(index / STACK_COLUMNS);
  return { dx: (col - (columns - 1) / 2) * STACK_GAP, dy: (row - (rows - 1) / 2) * STACK_GAP };
}

// The squares a token passes through: from, each square up to where it landed, then the ladder's top or the snake's tail
export function pathOf({ from, landed, to, via, stayed }: LastMove): number[] {
  if (stayed) return [];
  const walk = Array.from({ length: landed - from + 1 }, (_, step) => from + step);
  return via ? [...walk, to] : walk;
}
