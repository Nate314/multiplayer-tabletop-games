import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  if (!lastMove) return '';
  const name = playerNames[lastMove.playerNumber];
  return lastMove.type === 'resign' ? `${name} resigned` : `${name} played ${lastMove.notation}`;
}
