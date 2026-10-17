import { sourceName } from '../rules.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog, in the status line's words
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  if (!lastMove) return '';
  const { playerNumber, count, color, source, line } = lastMove;
  const destination = line === 'floor' ? 'the floor' : `line ${line + 1}`;
  return `${playerNames[playerNumber]} took ${count} ${color} from ${sourceName(source)} to ${destination}`;
}
