import { prefersReducedMotion } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import { centerOf, pathOf } from './geometry.ts';
import type { PublicGameState, Seat } from '../types.ts';

const STEP_MS = 120; // per square walked
const JUMP_MS = 400; // up the ladder or down the snake

export function tokenKey(seat: Seat): string {
  return `token-${seat}`;
}

// The mover's token walks square by square from where it was, then climbs or slides.
// The token is drawn in the board's SVG, where a CSS px is one board unit, so the translations are board units
// and need no screen measuring: they hold at any board size, the History dialog's scaled board included.
export default function animateMove({ next, root }: MoveChange<PublicGameState>) {
  const move = next.lastMove;
  if (!move || prefersReducedMotion()) return;
  const path = pathOf(move);
  if (path.length < 2) return;
  const element = root.querySelector(`[data-anim-key="${tokenKey(move.playerNumber)}"]`);
  if (!element) return;

  const end = centerOf(move.to);
  const legs = path.slice(1).map((_, index) => (move.via && index === path.length - 2 ? JUMP_MS : STEP_MS));
  const duration = legs.reduce((sum, leg) => sum + leg, 0);
  let elapsed = 0;
  const keyframes = path.map((square, index) => {
    if (index > 0) elapsed += legs[index - 1];
    const { x, y } = centerOf(square);
    return { transform: `translate(${x - end.x}px, ${y - end.y}px)`, offset: elapsed / duration };
  });
  element.getAnimations().forEach(animation => animation.cancel());
  element.animate(keyframes, { duration, easing: 'linear', fill: 'backwards' });
}
