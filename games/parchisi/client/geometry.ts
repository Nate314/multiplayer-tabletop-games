// Where each square of the cross sits on the 19 by 19 board grid
import { HOME, LAST_TRACK, SIDE_LENGTH, TRACK_LENGTH, isOnTrack, sideOf, trackIndex } from '../rules.ts';
import type { Progress, Seat } from '../types.ts';

export type Cell = { row: number; col: number };
export type Area = { rows: [number, number]; cols: [number, number] };

export const SEATS: Seat[] = [1, 2, 3, 4];
export const GRID_SIZE = 19;
const LAST = GRID_SIZE - 1;
const CENTER = LAST / 2;
const ARM = 8; // squares from the edge of the board to the center block

// A quarter turn counterclockwise around the center, which takes each side of the cross to the next one
function rotate({ row, col }: Cell, times: number): Cell {
  let cell = { row, col };
  for (let turn = 0; turn < times; turn++) cell = { row: LAST - cell.col, col: cell.row };
  return cell;
}

// The bottom side's 17 track squares: its home entrance, up the right column, then right along the row below center
const BOTTOM_TRACK: Cell[] = [
  { row: LAST, col: CENTER },
  ...Array.from({ length: ARM }, (_, index) => ({ row: LAST - index, col: CENTER + 1 })),
  ...Array.from({ length: ARM }, (_, index) => ({ row: CENTER + 1, col: CENTER + 2 + index }))
];

export const TRACK_CELLS: Cell[] = Array.from({ length: TRACK_LENGTH }, (_, index) =>
  rotate(BOTTOM_TRACK[index % SIDE_LENGTH], Math.floor(index / SIDE_LENGTH))
);

// Each side's nest is the corner to the right of its arm, as its player sees it
const BOTTOM_NEST: Area = { rows: [CENTER + 2, LAST], cols: [CENTER + 2, LAST] };

export function nestArea(seat: Seat): Area {
  const side = sideOf(seat);
  const a = rotate({ row: BOTTOM_NEST.rows[0], col: BOTTOM_NEST.cols[0] }, side);
  const b = rotate({ row: BOTTOM_NEST.rows[1], col: BOTTOM_NEST.cols[1] }, side);
  return { rows: [Math.min(a.row, b.row), Math.max(a.row, b.row)], cols: [Math.min(a.col, b.col), Math.max(a.col, b.col)] };
}

export const CENTER_AREA: Area = { rows: [CENTER - 1, CENTER + 1], cols: [CENTER - 1, CENTER + 1] };

// The square a pawn stands on, or null in the nest and at home
export function cellOf(seat: Seat, progress: Progress): Cell | null {
  if (isOnTrack(progress)) return TRACK_CELLS[trackIndex(seat, progress)];
  if (progress > LAST_TRACK && progress < HOME) {
    return rotate({ row: LAST - (progress - LAST_TRACK), col: CENTER }, sideOf(seat));
  }
  return null;
}

export const HOME_COLUMN: Progress[] = Array.from({ length: HOME - LAST_TRACK - 1 }, (_, index) => LAST_TRACK + 1 + index);

export function cellKey({ row, col }: Cell): string {
  return `${row}-${col}`;
}

// CSS grid lines are 1-based and the end line is exclusive
export function gridPlacement({ rows, cols }: Area) {
  return { gridRow: `${rows[0] + 1} / ${rows[1] + 2}`, gridColumn: `${cols[0] + 1} / ${cols[1] + 2}` };
}

export function cellPlacement(cell: Cell) {
  return gridPlacement({ rows: [cell.row, cell.row], cols: [cell.col, cell.col] });
}
