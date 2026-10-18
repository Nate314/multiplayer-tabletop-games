import { fadeIn } from '../../../src/animation/motion.ts';
import { meepleKey, tileKey } from './keys.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState } from '../types.ts';

// A placed tile fades in where it was put, and so does a meeple put on it
export default function animateMove({ next, root }: MoveChange<PublicGameState>) {
  const { lastMove, board } = next;
  if (!lastMove) return;
  const index = board.length - 1;
  const key = lastMove.type === 'place' ? tileKey(index) : lastMove.feature ? meepleKey(index) : null;
  const element = key ? root.querySelector(`[data-anim-key="${key}"]`) : null;
  if (element) fadeIn(element, 400);
}
