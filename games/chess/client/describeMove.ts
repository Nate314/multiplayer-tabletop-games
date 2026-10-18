import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  if (!lastMove) return '';
  return `${playerNames[lastMove.playerNumber]} played ${lastMove.notation}`;
}
