import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (pickCell, pickMeeple, the drag, Undo), TurnPanel.tsx (Turn, Place tile,
// Place meeple, No meeple), Board.tsx (the squares and circles, pan, wheel, zoom buttons) and src/drag/useDrag.ts (Escape)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Choose a square for the tile',
    pointer: 'On your turn, click or tap a highlighted square, or drag the tile picture onto one. Clicking or tapping another square, or dropping it there, changes the choice. ' +
      'Drop it anywhere else to put it back. This only previews the tile: nothing is played yet.',
    keys: 'Escape while dragging puts it back.'
  },
  {
    action: 'Turn the tile',
    pointer: 'Click or tap Turn left or Turn right. Once a square is chosen, only the turns that fit there are offered.'
  },
  { action: 'Place the tile', pointer: 'After choosing a square, click or tap Place tile.' },
  {
    action: 'Choose a spot for a meeple',
    pointer: 'After placing the tile, click or tap a circle on it, or drag your meeple from the tray onto one. Click or tap the chosen circle again to unchoose it. ' +
      'Drop it anywhere else to put it back.',
    keys: 'Escape while dragging puts it back.'
  },
  { action: 'Place or skip the meeple', pointer: 'Click or tap Place meeple to put it on the chosen circle, or No meeple to place none.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' },
  {
    action: 'Look around the board',
    pointer: 'Drag the board to pan it. Use the mouse wheel or the + and − buttons to zoom, and Fit to show every tile again. A drag never places a tile.'
  }
];
