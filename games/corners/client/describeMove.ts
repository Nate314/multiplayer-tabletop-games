import { plural } from '../../../shared/text.ts';
import { COLOR_NAMES } from '../rules.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog; the game-over status says who won
export function describeMove({ lastMove, playerNames, owners, board }: Pick<PublicGameState, 'lastMove' | 'playerNames' | 'owners' | 'board'>): string {
  if (!lastMove) return '';
  const shared = owners[lastMove.color] === 'shared' ? ' (shared)' : '';
  const size = plural(lastMove.cells.length, board === 'squares' ? 'square' : 'triangle');
  return `${playerNames[lastMove.playerNumber]} placed a piece of ${size} in ${COLOR_NAMES[lastMove.color]}${shared}`;
}
