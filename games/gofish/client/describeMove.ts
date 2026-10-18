import { describeAsk } from '../rules.ts';
import type { PublicGameState } from '../types.ts';

// The ask that produced this state, for the history dialog, in the status line's words
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  return lastMove ? describeAsk(lastMove, playerNames) : '';
}
