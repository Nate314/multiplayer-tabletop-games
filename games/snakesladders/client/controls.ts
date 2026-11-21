import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to RollPanel.tsx (Roll, Auto-roll) and GameScreen.tsx (roll, Undo). The board has no controls.
export const CONTROLS: ControlItem[] = [
  { action: 'Roll the die', pointer: 'On your turn, click or tap Roll. After a 6, roll again.' },
  {
    action: 'Roll automatically',
    pointer: 'Tick Auto-roll to roll for you one second after your turn comes up. It applies only in this browser tab and is off after a reload.'
  },
  { action: 'Ask to take back the last roll', pointer: 'Click or tap Undo. It happens only if every player still in the game approves.' }
];
