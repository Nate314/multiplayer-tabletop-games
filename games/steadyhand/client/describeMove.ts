import { pointsText } from '../../../shared/standings.ts';
import { PARTS } from '../board.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  if (!lastMove) return '';
  const name = playerNames[lastMove.playerNumber];
  const part = PARTS[lastMove.part].name;
  return lastMove.type === 'out' ? `${name} brought out the ${part} for ${pointsText(lastMove.value)}` : `${name} buzzed on the ${part}`;
}
