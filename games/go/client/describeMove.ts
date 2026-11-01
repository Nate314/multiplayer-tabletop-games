import { pointName } from '../board.ts';
import { scoreLine } from '../scoring.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog
export function describeMove({ lastMove, playerNames, size }: Pick<PublicGameState, 'lastMove' | 'playerNames' | 'size'>): string {
  if (!lastMove) return '';
  const name = playerNames[lastMove.playerNumber];
  if (lastMove.type === 'pass') return `${name} passed`;
  if (lastMove.type === 'score') return `Counted: ${scoreLine(lastMove.score)}`;
  const captures = lastMove.captured > 0 ? ` and captured ${lastMove.captured}` : '';
  return `${name} played ${pointName(lastMove.point, size)}${captures}`;
}
