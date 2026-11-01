import { moveSummary } from '../rules.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog
export function describeMove({ lastMove, playerNames, isGameOver, winners }: Pick<PublicGameState, 'lastMove' | 'playerNames' | 'isGameOver' | 'winners'>): string {
  if (!lastMove) return '';
  const won = isGameOver && winners.includes(lastMove.playerNumber);
  return moveSummary(playerNames[lastMove.playerNumber], lastMove, won);
}
