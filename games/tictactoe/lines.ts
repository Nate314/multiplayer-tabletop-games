// Tic-Tac-Toe win lines shared by the server (rules) and the browser (highlighting).
// Cells are indexes 0 to 8, row-major from the top left.
import type { Seat } from '../../shared/types.ts';

export type Cells = (Seat | null)[];
export type Line = readonly [number, number, number];

export const LINES: readonly Line[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6], // diagonals
];

export const CELL_NAMES: readonly string[] = [
  'top left', 'top middle', 'top right',
  'middle left', 'center', 'middle right',
  'bottom left', 'bottom middle', 'bottom right',
];

export function emptyCells(): Cells {
  return Array<Seat | null>(9).fill(null);
}

// The seat holding all three cells of a line, if any line is complete
export function findLine(cells: readonly (Seat | null)[]): { seat: Seat; line: Line } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const seat = cells[a];
    if (seat !== null && cells[b] === seat && cells[c] === seat) return { seat, line };
  }
  return null;
}

export function isFull(cells: readonly unknown[]): boolean {
  return cells.every(cell => cell !== null);
}

export function isCellIndex(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 8;
}
