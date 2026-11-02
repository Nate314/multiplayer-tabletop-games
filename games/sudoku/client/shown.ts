import { MODE_RULE, modeOf, type PuzzleMode } from '../../../shared/puzzleModes.ts';
import { CELLS } from '../grid.ts';
import type { Board, PublicGameState, Seat } from '../types.ts';

const EMPTY: Board = { entries: Array(CELLS).fill(0), by: Array(CELLS).fill(null) };

export const modeOfState = (state: PublicGameState): PuzzleMode => modeOf(state, MODE_RULE);

// The seats whose Race board is in this view, in seat order; none outside a Race
export function boardSeats(state: PublicGameState): Seat[] {
  if (modeOfState(state) !== 'race') return [];
  return Object.keys(state.raceBoards).map(Number).sort((a, b) => a - b);
}

// Whose Race board to show: the chosen one, else the viewer's own, else the last mover's, else the first; null outside a Race or with none in view
export function boardOwner(state: PublicGameState, viewer: Seat | null, chosen: Seat | null): Seat | null {
  const seats = boardSeats(state);
  return [chosen, viewer, state.lastMove?.playerNumber ?? null].find(seat => seat !== null && seats.includes(seat)) ?? seats[0] ?? null;
}

// The board to draw: the shared one, or `owner`'s Race board; with no Race board in view, only the givens
export function shownBoard(state: PublicGameState, owner: Seat | null): Board {
  if (modeOfState(state) !== 'race') return state.board;
  return (owner !== null ? state.raceBoards[owner] : undefined) ?? EMPTY;
}

// The cell to outline: the last move's, and in a Race only on the board of the player who made it
export function lastCellOn(state: PublicGameState, owner: Seat | null): number | null {
  const { lastMove } = state;
  if (!lastMove || lastMove.cell === undefined) return null;
  return modeOfState(state) === 'race' && lastMove.playerNumber !== owner ? null : lastMove.cell;
}
