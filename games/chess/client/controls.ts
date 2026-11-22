import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to Board.tsx (handleSquareClick, the drag, play), PromotionPicker.tsx, ClaimPrompt.tsx and
// GameScreen.tsx (Claim draw, Undo), plus src/components/DrawAndResign.tsx
export const CONTROLS: ControlItem[] = [
  {
    action: 'Move a piece',
    pointer: 'Your pieces are always at the bottom of the board. On your turn, click or tap one of your pieces. Its legal moves are marked: a dot for an empty square and a ring for a capture. ' +
      'Click or tap a marked square to move there. Click the piece again, or an empty unmarked square, to put it down, ' +
      'or click another of your pieces to pick that one instead. Or drag the piece onto a marked square; ' +
      'drop it anywhere else to put it back.',
    keys: 'Escape while dragging puts it back.'
  },
  { action: 'Castle', pointer: 'Click or tap your king, then the square two to its left or right. Or drag the king there.', keys: 'Escape while dragging puts it back.' },
  { action: 'Choose a promotion piece', pointer: 'When a pawn reaches the far rank, click or tap a queen, rook, bishop or knight in the box that appears, or Cancel to pick a different move.' },
  { action: 'Claim a draw', pointer: 'On your turn, when a claim is possible, click or tap Claim draw.' },
  { action: 'Claim a draw with your move', pointer: 'When your move would itself allow a claim, click or tap Move and claim draw, or Just move. Cancel picks a different move.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if your opponent approves.' },
  { action: 'Offer a draw', pointer: 'Click or tap Offer draw, at any time while the game runs.' },
  { action: 'Answer a draw offer', pointer: 'Click or tap Accept draw or Decline.' },
  { action: 'Resign', pointer: 'Click or tap Resign, then Confirm resign. Click or tap Keep playing to cancel.' }
];
