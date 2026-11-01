import { boardScale, slideFrom } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import { holeKey } from '../board.ts';
import { VIEW_RADIUS } from './geometry.ts';
import type { Hole, PublicGameState } from '../types.ts';

export function holeAnimKey({ q, r }: Hole): string {
  return `hole-${q}-${r}`;
}

// slideFrom moves by screen pixels, but a pixel of translate inside the board is one board unit,
// so the start is pulled toward the marble by the board's own scale to land where the marble was
function inBoardUnits(from: DOMRect, marble: Element): DOMRect {
  const board = marble.closest('svg.board');
  if (!board) return from;
  const to = marble.getBoundingClientRect();
  const ratio = (boardScale(marble) * 2 * VIEW_RADIUS) / board.getBoundingClientRect().width;
  const toX = to.x + to.width / 2;
  const toY = to.y + to.height / 2;
  const x = toX + (from.x + from.width / 2 - toX) * ratio;
  const y = toY + (from.y + from.height / 2 - toY) * ratio;
  return new DOMRect(x - from.width / 2, y - from.height / 2, from.width, from.height);
}

// The moved marble glides from the hole it left straight to where it stopped
export default function animateMove({ next, root, rectOf }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (!lastMove) return;
  const marble = root.querySelector(`[data-marble="${holeKey(lastMove.path[lastMove.path.length - 1])}"]`);
  const from = rectOf(holeAnimKey(lastMove.path[0]));
  if (marble && from) slideFrom(marble, inBoardUnits(from, marble));
}
