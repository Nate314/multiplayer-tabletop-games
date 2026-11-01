import { fadeIn } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { Point, PublicGameState } from '../types.ts';

export function pointKey({ row, col }: Point): string {
  return `go-point-${row}-${col}`;
}

// A placed stone fades in; a pass or the count has nothing to animate
export default function animateMove({ next, root }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (lastMove?.type !== 'place') return;
  const element = root.querySelector(`[data-anim-key="${pointKey(lastMove.point)}"]`);
  if (element) fadeIn(element);
}
