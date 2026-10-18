import { slideFrom } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { Position, PublicGameState } from '../types.ts';

export function squareKey({ row, col }: Position): string {
  return `square-${row}-${col}`;
}

// The moved piece glides from its old square straight to where it stopped; captured pieces simply disappear
export default function animateMove({ next, root, rectOf }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (!lastMove) return;

  const piece = root.querySelector(`[data-anim-key="${squareKey(lastMove.path[lastMove.path.length - 1])}"] .piece`);
  const from = rectOf(squareKey(lastMove.path[0]));
  if (piece && from) slideFrom(piece, from);
}
