import { slideFrom } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState, Seat } from '../types.ts';

export function pawnKey(seat: Seat, pawn: number): string {
  return `pawn-${seat}-${pawn}`;
}

// Every pawn that changed place glides from where it was: the moved pawn, a captured one and a penalized one
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  for (const [seat, progresses] of Object.entries(next.pawns)) {
    progresses.forEach((progress, pawn) => {
      if (previous.pawns[Number(seat)]?.[pawn] === progress) return;
      const key = pawnKey(Number(seat), pawn);
      const element = root.querySelector(`[data-anim-key="${key}"]`);
      const from = rectOf(key);
      if (element && from) slideFrom(element, from);
    });
  }
}
