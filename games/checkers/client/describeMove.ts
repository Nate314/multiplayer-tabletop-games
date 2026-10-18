import { moveSummary } from '../rules.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  return lastMove ? moveSummary(playerNames[lastMove.playerNumber], lastMove) : '';
}
