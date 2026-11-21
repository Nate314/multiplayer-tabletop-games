import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to PlayArea.tsx (the rack, the drag rules, the blank picker and the turn buttons), Board.tsx
// (the squares) and GameScreen.tsx (Undo, End game)
export const CONTROLS: ControlItem[] = [
  { action: 'Select a tile from your rack', pointer: 'On your turn, click or tap a tile on your rack. Click or tap it again to deselect it.' },
  {
    action: 'Place a tile',
    pointer: 'On your turn, click or tap an empty square with a tile selected, or drag a rack tile onto an empty square.'
  },
  { action: 'Choose the letter of a blank', pointer: 'Placing a blank shows the letters: click or tap the one it stands for, or Cancel.' },
  { action: 'Move a tile you placed this turn', pointer: 'On your turn, drag it to another empty square.' },
  { action: 'Take a placed tile back', pointer: 'On your turn, click or tap it, or drag it onto your rack.' },
  { action: 'Rearrange your rack', pointer: 'Drag a tile to another place on your rack, even when it is not your turn.' },
  { action: 'Shuffle your rack', pointer: 'Click or tap Shuffle, at any time.' },
  { action: 'Take back all your placed tiles', pointer: 'Click or tap Recall.' },
  { action: 'Play your word', pointer: 'On your turn, click or tap Play once the line under your rack shows its score.' },
  {
    action: 'Swap tiles for new ones',
    pointer: 'On your turn, click or tap Exchange, then click or tap each tile to swap (again to keep it), then click or tap the Exchange button again. Cancel backs out.'
  },
  { action: 'Pass', pointer: 'On your turn, click or tap Pass.' },
  { action: 'End the game', pointer: 'After six scoreless turns in a row, any player can click or tap End game.' },
  { action: 'Ask to take back the last turn', pointer: 'Click or tap Undo. It happens only if every player still in the game approves.' }
];
