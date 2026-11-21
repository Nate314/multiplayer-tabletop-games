import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameStatus.tsx (TurnActions: Roll, Double, Take, Drop), Board.tsx (handleClick, the drag, the die
// choice) and GameScreen.tsx (Undo)
export const CONTROLS: ControlItem[] = [
  { action: 'Roll the dice', pointer: 'At the start of your turn, click or tap Roll.' },
  { action: 'Double the stakes', pointer: 'Before rolling, click or tap Double if the cube is in the middle or yours.' },
  { action: 'Answer a double', pointer: 'Click or tap Take to play on for twice the stake, or Drop to concede the game.' },
  {
    action: 'Move a checker',
    pointer: 'On your turn, the checkers that can move are highlighted. Click or tap one, then click or tap one of its highlighted destinations. ' +
      'Click or tap the checker again, or anywhere else, to choose a different one. Or drag the checker onto a highlighted point; ' +
      'drop it anywhere else, or press Escape while dragging, to put it back.'
  },
  { action: 'Enter a checker from the bar', pointer: 'Click or tap your checker on the bar, then a highlighted point. Or drag it onto a highlighted point.' },
  { action: 'Bear off a checker', pointer: 'Click or tap the checker, then your highlighted tray. Or drag the checker onto your tray.' },
  { action: 'Choose the die to bear off with', pointer: 'When either die could bear the checker off, click or tap the die you want under the board, or Cancel.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if your opponent approves.' }
];
