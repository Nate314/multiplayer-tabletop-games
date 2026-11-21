import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (Flip, Auto-flip, Undo) and Table.tsx (your own pile, a button when you may flip)
export const CONTROLS: ControlItem[] = [
  { action: 'Flip a card', pointer: 'On your turn, click or tap Flip, or your own pile at the bottom of the table.' },
  {
    action: 'Flip automatically',
    pointer: 'Tick Auto-flip. Your card is then flipped for you shortly after your turn comes up. ' +
      'It works only in your own browser tab and is off again when you reload the page.'
  },
  { action: 'Ask to take back the last flip', pointer: 'Click or tap Undo. It happens only if both players approve.' }
];
