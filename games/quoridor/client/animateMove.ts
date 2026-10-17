import { fadeIn, slideFrom } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { Position, PublicGameState, Wall } from '../types.ts';

export function squareKey({ row, col }: Position): string {
  return `square-${row}-${col}`;
}

export function wallKey({ row, col, orientation }: Wall): string {
  return `wall-${row}-${col}-${orientation}`;
}

// The moved pawn glides from its old square (jumps included); a new wall fades in
export default function animateMove({ next, root, rectOf }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (!lastMove) return;

  const key = lastMove.type === 'move' ? `pawn-${lastMove.playerNumber}` : wallKey(lastMove);
  const element = root.querySelector(`[data-anim-key="${key}"]`);
  if (!element) return;

  if (lastMove.type === 'wall') {
    fadeIn(element);
    return;
  }
  const from = rectOf(squareKey(lastMove.from));
  if (from) slideFrom(element, from);
}
