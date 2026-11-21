import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (the prompt buttons, Undo) and src/components/guessing/Chat.tsx (the Guess box)
export const CONTROLS: ControlItem[] = [
  { action: 'Choose a prompt to act', pointer: 'When it is your turn to act, click or tap one of the prompts shown. Only you see them.' },
  {
    action: 'Guess the prompt, or chat',
    pointer: 'Everyone but the actor types in the box under the chat, then clicks or taps Send. The box says Guess until you have guessed the prompt.',
    keys: 'Enter sends what you typed.'
  },
  { action: 'Ask to take back the last scored guess or turn change', pointer: 'Click or tap Undo. It happens only if everyone else approves.' }
];
