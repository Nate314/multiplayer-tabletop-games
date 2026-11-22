import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (onKeyDown, the Place buttons, Undo) and TowerView.tsx (pointer and wheel handlers)
export const CONTROLS: ControlItem[] = [
  { action: 'Choose a block to pull', pointer: 'Click the tower.', keys: 'Tab to the tower, then the arrow keys choose a block.' },
  {
    action: 'Pull a block out',
    pointer: 'On your turn, press on a block and drag it out. A slow drag slides it gently, a fast one jerks it.',
    keys: 'Enter or Space grabs the chosen block, Down arrow pulls it out and Up arrow pushes it back. Pressing the same way again pulls harder.'
  },
  { action: 'Let go of a block', pointer: 'Release the press.', keys: 'Escape.' },
  {
    action: 'Turn the turntable',
    pointer: 'On your turn, press on empty space and drag left or right.',
    keys: 'On your turn, Q turns it left and E turns it right while held.'
  },
  { action: 'Tilt the view', pointer: 'Press on empty space and drag up or down.' },
  { action: 'Zoom the camera', pointer: 'Scroll the wheel or pinch with two fingers.' },
  { action: 'Turn the camera', pointer: 'Between turns, press on empty space and drag left or right.' },
  {
    action: 'Place the block on top',
    pointer: 'Drag it to an open spot on top, or click or tap Place on top, left, middle or right once the tower has stopped moving. With Free placement, let go where it should go.'
  },
  { action: 'Ask to undo the last turn', pointer: 'Click or tap Undo. It happens only if every connected player approves.' }
];
