import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to Board.tsx (handleClick, the drag) and GameScreen.tsx (Undo). The dice are rolled for you, so there is no Roll button.
export const CONTROLS: ControlItem[] = [
  {
    action: 'Select a pawn',
    pointer: 'On your turn, the pawns you can move glow. Click or tap one. Each square it can reach is marked with the dice that get it there: ' +
      '4 for one die, 2+3 for both dice, +20 for a bonus. Click or tap the selected pawn again to unselect it.'
  },
  {
    action: 'Move a pawn',
    pointer: 'Click or tap a marked square, or the center to go home. Or drag a glowing pawn onto a marked square or into the center; ' +
      'drop it anywhere else to put it back.',
    keys: 'Escape while dragging puts it back.'
  },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' }
];
