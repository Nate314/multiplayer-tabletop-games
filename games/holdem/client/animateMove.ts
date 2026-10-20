import { slideFrom } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState, Seat } from '../types.ts';
import { seatKey } from '../../../src/animation/animKeys.ts';

export const boardKey = (index: number) => `board-${index}`;

// Newly dealt board cards slide in from the button's seat, one after another
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  if (next.button === null || next.handNumber !== previous.handNumber) return;
  const from = rectOf(seatKey(next.button));
  if (!from) return;
  for (let index = previous.board.length; index < next.board.length; index++) {
    const element = root.querySelector(`[data-anim-key="${boardKey(index)}"]`);
    if (element) slideFrom(element, from, undefined, (index - previous.board.length) * 120);
  }
}
