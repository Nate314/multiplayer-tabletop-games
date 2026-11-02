import { moveSummary } from '../rules.ts';
import { markOf } from '../marks.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog
export function describeMove(state: Pick<PublicGameState, 'lastMove' | 'playerNames' | 'xSeat'>): string {
  const { lastMove, playerNames } = state;
  return lastMove ? moveSummary(playerNames[lastMove.playerNumber], markOf(state, lastMove.playerNumber), lastMove.cell) : '';
}
