import type { PublicGameState } from '../types.ts';

function tiles(count: number): string {
  return `${count} ${count === 1 ? 'tile' : 'tiles'}`;
}

// The move that produced this state, for the history dialog
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  if (!lastMove) return '';
  const name = playerNames[lastMove.playerNumber];
  if (lastMove.type === 'draw') return lastMove.drew ? `${name} drew a tile` : `${name} passed (the pool is empty)`;
  const played = lastMove.meld === null
    ? `${name} played ${tiles(lastMove.added.length)}`
    : `${name} made their first meld of ${lastMove.meld} points with ${tiles(lastMove.added.length)}`;
  return lastMove.wentOut ? `${played} and went out` : played;
}
