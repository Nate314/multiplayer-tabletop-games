import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog: one sentence per event, each naming the mover
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  if (!lastMove) return '';
  const name = playerNames[lastMove.playerNumber];
  return lastMove.events.map(event => `${name} ${event}`).join('. ');
}
