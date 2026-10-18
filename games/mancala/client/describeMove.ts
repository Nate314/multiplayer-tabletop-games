import { SIDES, describeTurn } from '../rules.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog. Pits are numbered 1 to 6 from the mover's left.
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  if (!lastMove) return '';
  return describeTurn(lastMove, playerNames, ` from pit ${lastMove.pit - SIDES[lastMove.playerNumber].firstPit + 1}`);
}
