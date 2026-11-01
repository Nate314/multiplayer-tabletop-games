import { MODE_RULE, modeOf, type PuzzleMode } from '../../../shared/puzzleModes.ts';
import { CELLS } from '../grid.ts';
import type { Board, PublicGameState, Seat } from '../types.ts';

const EMPTY: Board = { entries: Array(CELLS).fill(0), by: Array(CELLS).fill(null) };

export const modeOfState = (state: PublicGameState): PuzzleMode => modeOf(state, MODE_RULE);

// The board a viewer sees: the shared one, or in Race their own; a viewer with no Race board sees the last mover's, if shown, else only the givens
export function shownBoard(state: PublicGameState, viewer: Seat | null): Board {
  if (modeOfState(state) !== 'race') return state.board;
  const { raceBoards, lastMove } = state;
  return (viewer !== null ? raceBoards[viewer] : undefined) ?? (lastMove ? raceBoards[lastMove.playerNumber] : undefined) ?? EMPTY;
}
