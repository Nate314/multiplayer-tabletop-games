import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (Roll, Roll again, Roll six new dice, Bank, Undo) and Table.tsx (the dice)
export const CONTROLS: ControlItem[] = [
  { action: 'Roll the dice', pointer: 'On your turn, click or tap Roll.' },
  {
    action: 'Set dice aside',
    pointer: 'After a roll, click or tap the scoring dice to set them aside, and a set-aside die again to take it back.'
  },
  {
    action: 'Roll again',
    pointer: 'With dice set aside, click or tap Roll again. If you set aside all six, the button reads Roll six new dice.'
  },
  { action: 'Bank your points', pointer: 'With dice set aside, click or tap Bank.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if everyone approves.' }
];
