import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (pickTile, pickSpace, the drag, Draw, Pass, Undo, Rotate, Confirm, Cancel),
// Hand.tsx (the tiles) and Board.tsx (the zoom buttons and the spaces' Enter and Space handler)
export const CONTROLS: ControlItem[] = [
  { action: 'Play a tile', pointer: 'On your turn, click or tap a raised tile in your hand, then a lit space on the board. Or drag the tile to a lit space. A tile dropped anywhere else goes back.', keys: 'Tab to a tile, then Enter or Space to pick it up. Tab to a lit space, then Enter or Space to play it.' },
  { action: 'Put a tile back', pointer: 'Click or tap the held tile again.', keys: 'Enter or Space on the held tile.' },
  { action: 'Turn a tile that fits a space more than one way', pointer: 'Click or tap Rotate to show the next way it fits, then Confirm to play it or Cancel to put it back.' },
  { action: 'Draw a tile', pointer: 'When nothing fits, click or tap Draw.' },
  { action: 'Pass', pointer: 'When nothing fits and you cannot draw, click or tap Pass.' },
  { action: 'Go on to the next round', pointer: 'Click or tap Continue on the scoring screen. The next round is dealt once every connected player has.' },
  { action: 'See the whole board', pointer: 'Drag the board with a finger, or use the scroll wheel or scroll bars. Click or tap Zoom in or Zoom out.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every player still in the game approves.' }
];
