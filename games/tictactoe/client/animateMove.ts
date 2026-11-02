import { fadeIn } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState } from '../types.ts';

// Each cell's data-anim-key is `${CELL_PREFIX}-${cell}`
export const CELL_PREFIX = 'cell';

// The new mark fades in where it was placed
export default function animateMove({ next, root }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (!lastMove) return;
  const mark = root.querySelector(`[data-anim-key="${CELL_PREFIX}-${lastMove.cell}"] .mark`);
  if (mark) fadeIn(mark);
}
