import { BOARD_SIZE, getValidMoves, isValidWallPlacement } from '../rules.ts';
import type { BoardState, Move, Position, Seat } from '../types.ts';
import type { Action } from './types.ts';

// Drop target ids: a square as "<row>-<col>"
export const squareId = ({ row, col }: Position) => `${row}-${col}`;
export function squareOf(id: string): Position {
  const [row, col] = id.split('-').map(Number);
  return { row, col };
}

// What a tap on the tray's wall, or Rotate (the R key), selects next
export function nextWallAction(current: Action, input: 'tap' | 'rotate'): Action {
  if (current === 'move') return input === 'tap' ? 'wall-h' : 'wall-v';
  return current === 'wall-h' ? 'wall-v' : 'wall-h';
}

// Where a wall of the selected orientation could go now, as "<row>-<col>" anchor squares
export function wallSlots(state: BoardState & { wallCounts: Record<Seat, number> }, seat: Seat, action: Action): string[] {
  if (action === 'move') return [];
  const slots: string[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (squareMove(state, seat, action, { row, col })) slots.push(squareId({ row, col }));
    }
  }
  return slots;
}

type WallState = BoardState & { wallCounts: Record<Seat, number> };

// The move a click or a drop on `square` makes with `action` selected, or null when it does nothing
export function squareMove(state: WallState, seat: Seat, action: Action, square: Position): Move | null {
  if (action === 'move') {
    return getValidMoves(state, seat).some(move => move.row === square.row && move.col === square.col) ? { type: 'move', ...square } : null;
  }
  const wall = { ...square, orientation: action === 'wall-h' ? 'horizontal' as const : 'vertical' as const };
  return state.wallCounts[seat] > 0 && isValidWallPlacement(state, wall) ? { type: 'wall', ...wall } : null;
}
