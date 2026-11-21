import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (handlePoint), Board.tsx (the points' click and keyboard handlers) and Controls.tsx
// (Undo, Pass, Agree, Resume play, Resign)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Place a stone',
    pointer: 'On your turn, click or tap an empty point where the lines cross. With a mouse, a faint stone shows where yours would go on every point you can play.',
    keys: 'Tab to a point, then Enter or Space.'
  },
  { action: 'Pass', pointer: 'Click or tap Pass.' },
  {
    action: 'Mark a group of stones dead, or bring it back',
    pointer: 'After both players pass, click or tap a stone to mark its whole group dead, and again to bring it back. Either player can mark any stone.',
    keys: 'Tab to the stone, then Enter or Space.'
  },
  { action: 'Agree to the marks', pointer: 'Click or tap Agree. Any change to the marks clears both agreements.' },
  { action: 'Disagree about the marks', pointer: 'Click or tap Resume play. The marks and passes are cleared and play continues.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if your opponent approves.' },
  { action: 'Resign', pointer: 'Click or tap Resign, then Confirm resign. Keep playing changes your mind.' }
];
