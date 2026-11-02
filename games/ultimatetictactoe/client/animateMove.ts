import { fadeIn, flash } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState } from '../types.ts';

// Each cell's data-anim-key is `${cellPrefix(board)}-${cell}`
export const cellPrefix = (board: number) => `cell-${board}`;

// The new mark fades in where it was placed, and a board it claimed flashes
export default function animateMove({ next, root }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (!lastMove) return;
  const mark = root.querySelector(`[data-anim-key="${cellPrefix(lastMove.board)}-${lastMove.cell}"] .mark`);
  if (mark) fadeIn(mark);
  const board = root.querySelector(`.small-board[data-board="${lastMove.board}"]`);
  if (board && lastMove.claimed) flash(board);
}
