import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to BigBoard.tsx and tictactoe/client/Grid.tsx (the cells, buttons that are on only for a playable cell),
// GameScreen.tsx (Undo) and src/components/DrawAndResign.tsx
export const CONTROLS: ControlItem[] = [
  { action: 'Place a mark', pointer: 'On your turn, click or tap an empty cell in a highlighted board.' },
  { action: 'Ask to take back the last mark', pointer: 'Click or tap Undo. It happens only if your opponent approves.' },
  { action: 'Offer a draw', pointer: 'Click or tap Offer draw, at any time while the game runs.' },
  { action: 'Answer a draw offer', pointer: 'Click or tap Accept draw or Decline.' },
  { action: 'Resign', pointer: 'Click or tap Resign, then Confirm resign. Click or tap Keep playing to cancel.' }
];
