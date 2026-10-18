import { slideFrom } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import { otherSeat } from '../rules.ts';
import type { From, PublicGameState, Seat, To } from '../types.ts';

// The outermost checker of a point, a bar half or a bear-off tray
export function checkerKey(location: From | To, seat: Seat): string {
  return typeof location === 'number' ? `checker-${location}` : `checker-${location}-${seat}`;
}

function slide(change: MoveChange<PublicGameState>, fromKey: string, toKey: string) {
  const element = change.root.querySelector(`[data-anim-key="${toKey}"]`);
  const from = change.rectOf(fromKey);
  if (element && from) slideFrom(element, from);
}

// The moved checker glides to its new place; a checker it hit glides to the bar. Rolls and the cube do not animate.
export default function animateMove(change: MoveChange<PublicGameState>) {
  const { lastMove } = change.next;
  if (lastMove?.type !== 'move') return;
  const { playerNumber, from, to, hit } = lastMove;
  slide(change, checkerKey(from, playerNumber), checkerKey(to, playerNumber));
  if (hit) slide(change, checkerKey(to, playerNumber), checkerKey('bar', otherSeat(playerNumber)));
}
