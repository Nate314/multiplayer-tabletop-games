import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to Board.tsx (the disc tray's drag, the arrow buttons, the cells' click), GameScreen.tsx (Undo) and
// src/components/DrawAndResign.tsx
export const CONTROLS: ControlItem[] = [
  {
    action: 'Drop a disc',
    pointer: 'On your turn, drag your disc from the tray above the board onto a column, or click or tap the arrow above a column, or click or tap anywhere in the column. ' +
      'A full column cannot be chosen, and its arrow is greyed out.',
    keys: 'Escape while dragging puts it back.'
  },
  { action: 'Ask to take back the last disc', pointer: 'Click or tap Undo. It happens only if your opponent approves.' },
  { action: 'Offer a draw', pointer: 'Click or tap Offer draw, at any time while the game runs.' },
  { action: 'Answer a draw offer', pointer: 'Click or tap Accept draw or Decline.' },
  { action: 'Resign', pointer: 'Click or tap Resign, then Confirm resign. Click or tap Keep playing to cancel.' }
];
