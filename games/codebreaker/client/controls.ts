import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to ColorPicker.tsx (the colors, the row's slots, Clear, Submit guess or Set code) and GameScreen.tsx
// (Undo), plus the round summary's Continue button (RoundRows.tsx)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Build a guess',
    pointer: 'Click or tap the colors under Your guess: each fills the first empty slot of the row. In Classic, the maker builds the code the same way under Your code.'
  },
  { action: 'Empty a slot', pointer: 'Click or tap a peg in the row.' },
  { action: 'Empty the whole row', pointer: 'Click or tap Clear.' },
  {
    action: 'Send the row',
    pointer: 'Once every slot is filled, click or tap Submit guess, or Set code for the Classic maker. The row is only on your screen until you send it.'
  },
  { action: 'Start the next round', pointer: 'In Classic, after each round, click or tap Continue.' },
  {
    action: 'Take back a guess',
    pointer: 'Click or tap Undo. In Classic it happens only if the other player approves; in Solo it takes back your last guess at once. ' +
      'In Together and Race, click or tap Undo my last move to take back your own latest guess with no vote.'
  }
];
