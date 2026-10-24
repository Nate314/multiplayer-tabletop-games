import { cardKey } from './animateMove.ts';
import type { DrawnStep } from '../../../src/hooks/newlyDrawn.ts';
import type { PublicGameState, Seat } from '../types.ts';

// Your ask ends the old highlight and starts a new one with the card you fished, if it is still in your hand
// (a book lays it down). Cards other players hand over, and other players' asks, are not highlighted.
export function drawnStep(_previous: PublicGameState, next: PublicGameState, seat: Seat): DrawnStep<string> {
  const { lastMove, fishedCard, hand } = next;
  if (lastMove?.asker !== seat) return { add: [], clear: false };
  const kept = fishedCard && hand.some(card => card.rank === fishedCard.rank && card.suit === fishedCard.suit);
  return { add: kept ? [cardKey(fishedCard)] : [], clear: true };
}
