import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (the key handler, handleCell, Undo), Tray.tsx (the piece and Turn, Flip, Place buttons)
// and Board.tsx (the outlined spots' keyboard handler); the first-tap preview is placeInput.ts tapSpot
export const CONTROLS: ControlItem[] = [
  { action: 'Pick a piece', pointer: 'On your turn, click or tap a piece in your tray. Click or tap it again to put it back.', keys: 'Escape puts the piece back.' },
  { action: 'Turn the piece left or right', pointer: 'Click or tap Turn left or Turn right.', keys: 'Q turns it left and E turns it right.' },
  { action: 'Flip the piece', pointer: 'Click or tap Flip.', keys: 'F.' },
  {
    action: 'Place the piece',
    pointer: 'Outlined cells mark every place it can go. With a mouse, the piece shows under the pointer and a click places it. On a phone, the first tap shows the piece there and a second tap on it places it. Place also places the piece that is showing.',
    keys: 'Tab to an outlined cell, then Enter or Space shows the piece there, and Enter or Space again places it.'
  },
  { action: 'Ask to take back the last turn', pointer: 'Click or tap Undo. It happens only if every connected player approves.' }
];
