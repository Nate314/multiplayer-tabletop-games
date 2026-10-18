import { moveText } from '../rules.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog, in the status line's words
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  if (!lastMove) return '';
  return moveText(playerNames[lastMove.playerNumber], lastMove);
}
