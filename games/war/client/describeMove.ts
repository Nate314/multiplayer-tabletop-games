import { describeMove as describe } from '../rules.ts';
import type { PublicGameState } from '../types.ts';

// The flip that produced this state, for the history dialog, in the status line's words
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  return lastMove ? describe(lastMove, playerNames) : '';
}
