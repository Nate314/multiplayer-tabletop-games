import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to Placement.tsx (the tray, onCell, onRotate, the placement buttons, the drag), GameScreen.tsx
// (onTarget, Fire, Undo), Grid.tsx (the squares) and src/components/DrawAndResign.tsx
export const CONTROLS: ControlItem[] = [
  {
    action: 'Place a ship',
    pointer: 'Drag a ship from the tray onto your grid, or click or tap a ship and then a square. Its top or left end goes on that square.'
  },
  {
    action: 'Move a placed ship',
    pointer: 'Click or tap a placed ship to pick it, then an empty square to move it there. Or drag it onto a square. Click or tap it again to put it down.'
  },
  { action: 'Turn a ship', pointer: 'Click or tap Rotate. It turns the picked ship about its end, or the ships still in the tray if none is picked.' },
  { action: 'Take a ship off the grid', pointer: 'Pick the ship and click or tap Remove, or drag it back onto the tray.' },
  { action: 'Place the whole fleet at once', pointer: 'Click or tap Random placement. Click or tap Clear to start over.' },
  { action: 'Confirm your fleet', pointer: 'When every ship is placed, click or tap Confirm fleet. A confirmed fleet cannot be changed.' },
  { action: 'Fire a shot', pointer: 'On your turn, click or tap a square on the Target grid that you have not fired at yet.' },
  {
    action: 'Fire a salvo',
    pointer: 'With the Salvo house rule, click or tap Target squares to mark them, and a marked square again to unmark it. ' +
      'When you have marked as many as the Fire button asks for, click or tap Fire.'
  },
  { action: 'Ask to take back the last turn', pointer: 'Click or tap Undo. It happens only if the other player approves.' },
  { action: 'Offer a draw', pointer: 'Once a fleet is placed, click or tap Offer draw.' },
  { action: 'Answer a draw offer', pointer: 'Click or tap Accept draw or Decline.' },
  { action: 'Resign', pointer: 'Once a fleet is placed, click or tap Resign, then Confirm resign. Keep playing changes your mind.' }
];
