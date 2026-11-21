import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (the word buttons, Undo), Canvas.tsx (the pointer handling), Toolbar.tsx
// (the tools shown to the drawer while drawing) and src/components/guessing/Chat.tsx (the Guess box)
export const CONTROLS: ControlItem[] = [
  { action: 'Choose a word to draw', pointer: 'When it is your turn to draw, click or tap one of the words shown. Only you see them.' },
  {
    action: 'Draw a line',
    pointer: 'While you draw, press and drag on the paper with a mouse, a finger or a pen. A second finger is ignored while a line is in progress, and a drag past the edge stays on the paper.'
  },
  { action: 'Pick a color', pointer: 'Click or tap a color in the toolbar under the paper. This turns the eraser off.' },
  { action: 'Pick a brush size', pointer: 'Click or tap Small, Medium or Large in the toolbar.' },
  { action: 'Erase', pointer: 'Click or tap Eraser, then drag on the paper. Click or tap Eraser again to go back to the pen.' },
  { action: 'Fill an area', pointer: 'Click or tap Fill, then click or tap the paper. The area around that point takes the chosen color. Click or tap Fill again to go back to the pen.' },
  { action: 'Take back your last line or fill', pointer: 'Click or tap Take back.' },
  { action: 'Wipe the paper', pointer: 'Click or tap Clear.' },
  {
    action: 'Guess the word, or chat',
    pointer: 'Everyone but the drawer types in the box under the chat, then clicks or taps Send. The box says Guess until you have guessed the word.',
    keys: 'Enter sends what you typed.'
  },
  { action: 'Ask to take back the last scored guess or turn change', pointer: 'Click or tap Undo. It happens only if everyone else approves.' }
];
