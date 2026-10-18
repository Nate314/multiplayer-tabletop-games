import { slideFrom } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState, Square } from '../types.ts';

export function squareKey({ row, col }: Square): string {
  return `square-${row}-${col}`;
}

export function pieceKey({ row, col }: Square): string {
  return `piece-${row}-${col}`;
}

function slide(root: HTMLElement, rectOf: MoveChange<PublicGameState>['rectOf'], from: Square, to: Square) {
  const element = root.querySelector(`[data-anim-key="${pieceKey(to)}"]`);
  const start = rectOf(squareKey(from));
  if (element && start) slideFrom(element, start);
}

// The moved piece glides from its old square; when castling, the rook glides too
export default function animateMove({ next, root, rectOf }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (!lastMove) return;

  const { from, to, notation } = lastMove;
  slide(root, rectOf, from, to);
  if (notation.startsWith('O-O')) {
    const [rookFrom, rookTo] = to.col > from.col ? [7, 5] : [0, 3];
    slide(root, rectOf, { row: from.row, col: rookFrom }, { row: from.row, col: rookTo });
  }
}
