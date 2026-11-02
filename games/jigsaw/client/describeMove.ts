import { MODE_RULE, modeOf } from '../../../shared/puzzleModes.ts';
import type { PublicGameState } from '../types.ts';

// The step that produced this state, for the history dialog
export function describeMove(state: PublicGameState): string {
  const { lastMove, playerNames, isGameOver } = state;
  if (!lastMove) return '';
  const name = playerNames[lastMove.playerNumber];
  if (lastMove.type === 'unsnap') return `${name} took back a piece`;
  if (isGameOver) return `${name} placed the last piece`;
  const board = modeOf(state, MODE_RULE) === 'race' ? state.boards[lastMove.playerNumber] : state.board;
  if (!board) return `${name} placed a piece`;
  return `${name} placed a piece (${board.pieces.filter(piece => piece.placed).length} of ${board.pieces.length})`;
}
