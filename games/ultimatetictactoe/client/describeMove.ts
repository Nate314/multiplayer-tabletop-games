import { moveSummary } from '../rules.ts';
import { markOf } from '../../tictactoe/marks.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog
export function describeMove(state: Pick<PublicGameState, 'lastMove' | 'playerNames' | 'xSeat'>): string {
  const { lastMove, playerNames } = state;
  if (!lastMove) return '';
  const { playerNumber, board, cell, claimed } = lastMove;
  return moveSummary(playerNames[playerNumber], markOf(state, playerNumber), board, cell, claimed);
}
