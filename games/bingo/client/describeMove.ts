import { ordinal } from '../../../src/components/gameOver.ts';
import { letterOf } from '../cards.ts';
import type { PublicGameState } from '../types.ts';

// The call or claim that produced this state, for the history dialog, e.g. 'Alice called N 42'
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  if (!lastMove) return '';
  const name = playerNames[lastMove.seat];
  return lastMove.type === 'call'
    ? `${name} called ${letterOf(lastMove.number)} ${lastMove.number}`
    : `${name} shouted Bingo (${ordinal(lastMove.place)} place)`;
}
