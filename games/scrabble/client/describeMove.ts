import type { PublicGameState } from '../types.ts';

// "A, B and C"
function list(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// The move that produced this state, for the history dialog
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  if (!lastMove) return '';
  const name = playerNames[lastMove.playerNumber];
  if (lastMove.type === 'pass' && lastMove.timedOut) return `${name} ran out of time`;
  if (lastMove.type === 'pass') return `${name} passed`;
  if (lastMove.type === 'exchange') return `${name} exchanged ${lastMove.count} ${lastMove.count === 1 ? 'tile' : 'tiles'}`;
  const words = list(lastMove.words.map(word => word.word));
  return `${name} played ${words} for ${lastMove.points} points${lastMove.bingo ? ' (bingo!)' : ''}`;
}
