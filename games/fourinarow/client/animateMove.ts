import { slideFrom } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { Position, PublicGameState } from '../types.ts';

export function cellKey({ row, col }: Position): string {
  return `cell-${row}-${col}`;
}

// The new disc drops from the top of its column to where it came to rest
export default function animateMove({ next, root, rectOf }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (!lastMove) return;

  const disc = root.querySelector(`[data-anim-key="${cellKey({ row: lastMove.row, col: lastMove.column })}"] .disc`);
  const from = rectOf(cellKey({ row: 0, col: lastMove.column }));
  if (disc && from) slideFrom(disc, from);
}
