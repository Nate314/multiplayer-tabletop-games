import { CARDS } from '../cards.ts';
import type { DrawnStep } from '../../../src/hooks/newlyDrawn.ts';
import type { Card, PublicGameState, Seat } from '../types.ts';

// A draw outlines the colors you took; the second card of the draw adds to the first, and any other move of yours clears.
// Other players' moves change nothing.
export function drawnStep(previous: PublicGameState, next: PublicGameState, seat: Seat): DrawnStep<Card> {
  const { lastMove } = next;
  if (lastMove?.seat !== seat) return { add: [], clear: false };
  if (lastMove.type !== 'drawCard') return { add: [], clear: true };
  const before = previous.players[seat]?.hand;
  const after = next.players[seat]?.hand;
  const add = before && after ? CARDS.filter(card => after[card] > before[card]) : [];
  return { add, clear: !lastMove.second };
}
