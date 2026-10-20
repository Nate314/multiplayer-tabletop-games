import { fadeIn } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState } from '../types.ts';

// The dice of a roll fade in. Setting aside and banking do not animate.
export default function animateMove({ next, root }: MoveChange<PublicGameState>) {
  if (next.lastMove?.type !== 'roll') return;
  root.querySelectorAll('.farkle-dice [data-anim-key]').forEach(die => fadeIn(die));
}
