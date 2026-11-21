import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (handleSquareClick, the drag, Undo), Board.tsx (the squares) and
// src/components/DrawAndResign.tsx
export const CONTROLS: ControlItem[] = [
  {
    action: 'Move a piece',
    pointer: 'On your turn, click or tap one of your pieces, then a highlighted square. Click the piece again to let it go, ' +
      'or click or tap another of your pieces to choose that one instead. Or drag the piece onto a highlighted square; ' +
      'drop it anywhere else, or press Escape while dragging, to put it back.'
  },
  {
    action: 'Make a multi-jump',
    pointer: 'Click or tap each landing square in turn. The move is sent once no more jumps are left. To start over, click the piece again. ' +
      'A drag stops at each landing: drag the piece again, or click or tap the next landing square.'
  },
  { action: 'Ask to take back the last turn', pointer: 'Click or tap Undo. It happens only if your opponent approves.' },
  { action: 'Offer a draw', pointer: 'Click or tap Offer draw, at any time while the game runs.' },
  { action: 'Answer a draw offer', pointer: 'Click or tap Accept draw or Decline.' },
  { action: 'Resign', pointer: 'Click or tap Resign, then Confirm resign. Keep playing changes your mind.' }
];
