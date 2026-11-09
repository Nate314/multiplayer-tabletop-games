import { prefersReducedMotion, slideFrom } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import { ROAD } from '../road.ts';
import type { PublicGameState, Seat } from '../types.ts';

export const tokenKey = (seat: Seat): string => `token-${seat}`;
export const pieceKey = (seat: Seat): string => `piece-${seat}`;

const STEP_MS = 140;

// The spaces from `from` to `to` along the road, both included; one path leads to each space a single move can reach
export function roadPath(from: number, to: number): number[] {
  const cameFrom = new Map<number, number>([[from, from]]);
  const queue = [from];
  while (queue.length > 0 && !cameFrom.has(to)) {
    const at = queue.shift()!;
    for (const next of ROAD[at].next.filter(n => !cameFrom.has(n))) {
      cameFrom.set(next, at);
      queue.push(next);
    }
  }
  if (!cameFrom.has(to)) return [to];
  const path = [to];
  while (path[0] !== from) path.unshift(cameFrom.get(path[0])!);
  return path;
}

// A road token walks space by space along what it passed; a piece on the 1860 board glides straight to its square
export default function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  if (next.checkered && previous.checkered) {
    for (const [seat, cell] of Object.entries(next.checkered.pieces)) {
      const before = previous.checkered.pieces[Number(seat)];
      if (!before || (before.row === cell.row && before.col === cell.col)) continue;
      const key = pieceKey(Number(seat));
      const element = root.querySelector(`[data-anim-key="${key}"]`);
      const from = rectOf(key);
      if (element && from) slideFrom(element, from, 450);
    }
  }
  if (!next.road || !previous.road || prefersReducedMotion()) return;
  for (const [key, player] of Object.entries(next.road.players)) {
    const before = previous.road.players[Number(key)]?.space;
    const token = root.querySelector(`[data-anim-key="${tokenKey(Number(key))}"]`);
    if (before === undefined || before === player.space || !token) continue;
    // Space centers in the board's own units, which a translate on an SVG element uses whatever the board's scale
    const centers = roadPath(before, player.space).map(space => {
      const circle = root.querySelector(`[data-space="${space}"] circle`);
      return { x: Number(circle?.getAttribute('cx')), y: Number(circle?.getAttribute('cy')) };
    });
    const end = centers.at(-1)!;
    token.getAnimations().forEach(animation => animation.cancel());
    token.animate(centers.map(c => ({ translate: `${c.x - end.x}px ${c.y - end.y}px` })), { duration: STEP_MS * centers.length, easing: 'linear' });
  }
}
