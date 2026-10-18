import { slideFrom } from '../../../src/animation/motion.ts';
import { tokenKey } from './layout.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState } from '../types.ts';

// Every token that changed space glides there from where it was
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  for (const [seat, space] of Object.entries(next.positions)) {
    if (previous.positions[Number(seat)] === space) continue;
    const key = tokenKey(Number(seat));
    const element = root.querySelector(`[data-anim-key="${key}"]`);
    const from = rectOf(key);
    if (element && from) slideFrom(element, from, 450);
  }
}
