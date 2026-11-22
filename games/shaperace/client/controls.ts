import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (the tray button's pointer handlers, onShapeKey, onHoleKey, the R key listener,
// escaped) and RaceBoard.tsx (the hole targets)
export const CONTROLS: ControlItem[] = [
  { action: 'Turn a shape', pointer: 'During the race, click or tap a shape in the tray. Each tap turns it an eighth of a turn (45 degrees) clockwise.', keys: 'Press R while you hold a shape.' },
  { action: 'Pick a shape up', pointer: 'During the race, press a shape in the tray and drag it.', keys: 'Tab to a shape in the tray, then Enter or Space.' },
  { action: 'Choose a hole', keys: 'With a shape held, the arrow keys move between the empty holes.' },
  { action: 'Drop a shape in a hole', pointer: 'Let go over its hole. It drops in only if it fits and is turned the right way. Anywhere else it springs back.', keys: 'Enter or Space on the hole.' },
  { action: 'Put a held shape back', keys: 'Escape.' }
];
