import { SIDES } from '../rules.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog. Pits are numbered 1 to 6 from the mover's left.
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  if (!lastMove) return '';
  const { playerNumber, pit, sown, captured, extraTurn } = lastMove;
  const text = `${playerNames[playerNumber]} sowed ${sown} from pit ${pit - SIDES[playerNumber].firstPit + 1}`;
  if (captured > 0) return `${text} and captured ${captured}`;
  return extraTurn ? `${text} for an extra turn` : text;
}
