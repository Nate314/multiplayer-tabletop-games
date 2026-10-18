import { fadeIn } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState } from '../types.ts';

export const routeKey = (route: number) => `route-${route}`;
export const slotKey = (slot: number) => `slot-${slot}`;

// What changed on the table: the route just claimed, and every face-up slot that now shows a different card
export function changedKeys(previous: Pick<PublicGameState, 'faceUp'>, next: Pick<PublicGameState, 'faceUp' | 'lastMove'>): string[] {
  const keys = next.lastMove?.type === 'claim' ? [routeKey(next.lastMove.route)] : [];
  next.faceUp.forEach((card, slot) => {
    if (card !== null && card !== previous.faceUp[slot]) keys.push(slotKey(slot));
  });
  return keys;
}

// A claimed route and newly turned up cards fade in
export default function animateMove({ previous, next, root }: MoveChange<PublicGameState>) {
  for (const key of changedKeys(previous, next)) {
    const element = root.querySelector(`[data-anim-key="${key}"]`);
    if (element) fadeIn(element, 450);
  }
}
