import type { DrawnStep } from '../../../src/hooks/newlyDrawn.ts';
import type { PublicGameState, Seat } from '../types.ts';

// Any move of yours ends the old highlight; a draw starts a new one with the tile you got. Other players change nothing.
export function drawnStep(previous: PublicGameState, next: PublicGameState, seat: Seat): DrawnStep<number> {
  const { lastMove } = next;
  if (lastMove?.playerNumber !== seat) return { add: [], clear: false };
  const add = lastMove.type === 'draw' ? next.rack.filter(id => !previous.rack.includes(id)) : [];
  return { add, clear: true };
}
