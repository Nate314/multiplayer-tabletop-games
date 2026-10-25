import type { DrawnStep } from '../../../src/hooks/newlyDrawn.ts';
import type { PublicGameState, Seat } from '../types.ts';

// What your last move did to the highlight: a draw starts it fresh with the card you got, a discard ends it,
// laying down and hitting keep it, and other players' moves change nothing
export function drawnStep(previous: PublicGameState, next: PublicGameState, seat: Seat): DrawnStep<number> {
  const { lastMove } = next;
  if (lastMove?.playerNumber !== seat) return { add: [], clear: false };
  switch (lastMove.type) {
    case 'draw':
      return { add: next.myHand.filter(card => !previous.myHand.some(old => old.id === card.id)).map(card => card.id), clear: true };
    case 'discard':
      return { add: [], clear: true };
    default:
      return { add: [], clear: false };
  }
}
