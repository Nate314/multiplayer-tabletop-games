import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (Turn: Roll, Roll again, the dice's onToggle; Undo), ScoreSheet.tsx (the score buttons)
// and src/components/Dice.tsx (a die is a toggle button only while onToggle is given)
export const CONTROLS: ControlItem[] = [
  { action: 'Roll the dice', pointer: 'On your turn, click or tap Roll.' },
  {
    action: 'Hold dice',
    pointer: 'After a roll, while you have rolls left, click or tap a die to hold it, and click or tap it again to let it go. Held dice get a green outline.'
  },
  { action: 'Roll again', pointer: 'Click or tap Roll again. Only the dice you are not holding are rolled.' },
  {
    action: 'Score a box',
    pointer: 'After a roll, click or tap the number shown in an empty box of your own column. A dimmed number cannot be chosen.'
  },
  { action: 'Ask to take back the last roll or score', pointer: 'Click or tap Undo. It happens only if the other players approve.' }
];
