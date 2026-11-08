import { sameCard } from '../rules.ts';
import type { DrawnStep } from '../../../src/hooks/newlyDrawn.ts';
import type { Card, PublicGameState, Seat } from '../types.ts';

// The cards in `hand` that `earlier` did not have, counting copies
function gained(hand: Card[], earlier: Card[]): Card[] {
  const rest = [...earlier];
  return hand.filter(card => {
    const found = rest.findIndex(held => sameCard(held, card));
    if (found < 0) return true;
    rest.splice(found, 1);
    return false;
  });
}

// Your own move starts the highlight fresh (with what it made you draw, if anything); a Draw Two or Wild Draw Four
// from another player adds to it, so every card you were made to take stays outlined until your next move
export function drawnStep(previous: PublicGameState, next: PublicGameState, seat: Seat): DrawnStep<Card> {
  return { add: gained(next.hand, previous.hand), clear: next.lastMove?.playerNumber === seat };
}

// Which slots of the hand (as shown, sorted) are newly drawn: each drawn card marks one matching slot
export function markDrawn(hand: Card[], drawn: Card[]): boolean[] {
  const rest = [...drawn];
  return hand.map(card => {
    const found = rest.findIndex(held => sameCard(held, card));
    if (found < 0) return false;
    rest.splice(found, 1);
    return true;
  });
}
