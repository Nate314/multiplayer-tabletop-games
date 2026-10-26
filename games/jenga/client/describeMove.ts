import { BLOCK } from '../physics.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog; the level a block came from is read off its old height, counted from one
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  if (!lastMove) return '';
  const name = playerNames[lastMove.seat];
  if (lastMove.type === 'topple') return `${name} toppled the tower`;
  return `${name} pulled a block from level ${Math.floor(lastMove.from.p[1] / BLOCK.height) + 1} and placed it on top`;
}
