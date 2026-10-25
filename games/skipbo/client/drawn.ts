import type { DrawnStep } from '../../../src/hooks/newlyDrawn.ts';
import type { PublicGameState, Seat } from '../types.ts';

// The cards that reach your hand (dealt for your turn, or when a play empties it) are outlined until your discard or
// end of turn; plays in between keep them
export function drawnStep(previous: PublicGameState, next: PublicGameState, seat: Seat): DrawnStep<number> {
  const { lastMove } = next;
  const add = next.myHand.filter(card => !previous.myHand.some(old => old.id === card.id)).map(card => card.id);
  const turnEnded = lastMove?.playerNumber === seat && (lastMove.type === 'discard' || lastMove.type === 'endTurn');
  return { add, clear: turnEnded };
}
