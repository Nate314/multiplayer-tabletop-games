import { SIDES, describeTurn, opponentOf } from '../rules.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog. Pits are numbered 1 to 6 from their owner's left.
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  if (!lastMove) return '';
  const owner = lastMove.fromOpponent ? opponentOf(lastMove.playerNumber) : lastMove.playerNumber;
  return describeTurn(lastMove, playerNames, lastMove.pit - SIDES[owner].firstPit + 1);
}
