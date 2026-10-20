import { slideFrom } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState } from '../types.ts';
import { seatKey } from '../../../src/animation/animKeys.ts';

export const handKey = (tile: number) => `hand-${tile}`;
export const lineKey = (tile: number) => `line-${tile}`;

// A played tile slides into the line from your hand, or from the player who played it
export default function animateMove({ next, root, rectOf }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (lastMove?.type !== 'play') return;
  const element = root.querySelector(`[data-anim-key="${lineKey(lastMove.tile)}"]`);
  const from = rectOf(handKey(lastMove.tile)) ?? rectOf(seatKey(lastMove.playerNumber));
  if (element && from) slideFrom(element, from);
}
