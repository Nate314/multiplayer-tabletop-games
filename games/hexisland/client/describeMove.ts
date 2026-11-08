import { describeMove as describe } from '../rules.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog, in the status line's words
export function describeMove({ lastMove }: Pick<PublicGameState, 'lastMove'>): string {
  return lastMove ? describe(lastMove) : '';
}
