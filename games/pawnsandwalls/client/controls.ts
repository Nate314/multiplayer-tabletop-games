import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (the Your action tray, the drag, the R key), Board.tsx (the squares' click, hover and drop targets)
// and ActionButtons.tsx (Undo). The squares have no keyboard handler, so only R and the tray buttons are keys.
export const CONTROLS: ControlItem[] = [
  {
    action: 'Move your pawn',
    pointer: 'On your turn, with Move selected, click or tap a highlighted square. Move is selected at the start of every turn. Or drag your pawn onto a highlighted square; drop it anywhere else to put it back.',
    keys: 'Escape while dragging puts it back.'
  },
  {
    action: 'Pick up a wall',
    pointer: 'Click or tap the wall in the Your action box, or drag it onto the board. It starts horizontal.',
    keys: 'Escape while dragging puts it back.'
  },
  {
    action: 'Turn the wall',
    pointer: 'Click or tap the wall in the Your action box again.',
    keys: 'R, while you hold a wall.'
  },
  {
    action: 'Place the wall',
    pointer: 'A dot on the bottom right corner of a square marks each place it can go. Hover over the board to preview the wall and click to place it, tap a square, or drop the dragged wall there.',
    keys: 'Escape while dragging puts it back.'
  },
  { action: 'Put the wall down and move instead', pointer: 'Click or tap Move in the Your action box.' },
  { action: 'Ask to take back the last turn', pointer: 'Click or tap Undo. It happens only if every connected player approves.' }
];
