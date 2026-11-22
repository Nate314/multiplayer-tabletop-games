import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to PicturePicker.tsx (the thumbnails, Upload a photo), SidePanel.tsx (Show picture guide, Undo), GameScreen.tsx
// (Zoom, the table's keyboard handlers onPieceKey and onSpotKey, R and the right-click turn, the scrolling table) and Table.tsx (the Turn piece handle)
export const CONTROLS: ControlItem[] = [
  { action: 'Pick the picture', pointer: 'Before the first piece is picked up, the host clicks or taps one of the built-in pictures.' },
  { action: 'Use your own photo', pointer: 'Before the first piece is picked up, the host clicks or taps Upload a photo and chooses a JPEG or PNG.' },
  { action: 'Show the picture on the board', pointer: 'Click or tap Show picture guide to draw the picture faintly on the board.' },
  {
    action: 'Pick up a piece',
    pointer: 'Press a piece that nobody else is holding.',
    keys: 'Tab to the table, use the arrow keys to choose a piece, then Enter or Space.'
  },
  {
    action: 'Drop a piece',
    pointer: 'Drag it and let go. Close to its spot it snaps in and locks; anywhere else it stays where you left it.',
    keys: 'Use the arrow keys to choose a spot, then Enter or Space drops it there.'
  },
  { action: 'Put a held piece back', keys: 'Escape puts it back where it lay.' },
  {
    action: 'Turn a piece',
    pointer: 'With the Rotate pieces house rule: touch a piece and click or tap the ↻ at its top right corner, or right-click while you hold it. Each turn is 90 degrees clockwise.',
    keys: 'With the Rotate pieces house rule: R while you hold a piece.'
  },
  { action: 'Zoom the table', pointer: 'Click or tap Zoom in or Zoom out.' },
  { action: 'Scroll the zoomed table', pointer: 'Drag with a finger on an empty spot.' },
  { action: 'Take back your last move', pointer: 'Click or tap Undo. In Together and Race it is Undo my last move, and it takes back only your own last placed piece.' }
];
