import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (onKeyDown, Show mistakes, Undo), keys.ts (the key map), Grid.tsx (the cells),
// DigitPad.tsx (digits, Pencil, Erase) and BoardPicker.tsx
export const CONTROLS: ControlItem[] = [
  { action: 'Select a square', pointer: 'Click or tap an empty square. The givens cannot be selected.', keys: 'The arrow keys move the selection and skip the givens. With nothing selected, an arrow starts at the top left.' },
  { action: 'Fill in a square', pointer: 'Click or tap a digit on the pad.', keys: 'Press 1 to 9.' },
  { action: 'Erase a square', pointer: 'Click or tap Erase.', keys: 'Press Backspace, Delete or 0.' },
  { action: 'Turn pencil marks on or off', pointer: 'Click or tap Pencil. While it is on, a digit adds or removes a note instead of an entry.', keys: 'Press N.' },
  { action: 'Show mistakes', pointer: 'In Solo, click or tap Show mistakes to turn it on or off.' },
  { action: 'Take back a move', pointer: 'In Solo, click or tap Undo. In Together and Race, click or tap Undo my last move.' },
  { action: 'Look at another board', pointer: 'In a Race that is over, click or tap a player\'s name above the grid.' }
];
