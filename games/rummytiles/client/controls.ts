import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to PlayArea.tsx (rack, Sort, Play, Save, Reset, Draw, the drag), TableArea.tsx (group handles,
// split bars, the + and New group targets), Pickable.tsx (Enter and Space on a tile or handle) and GameScreen.tsx (Undo)
export const CONTROLS: ControlItem[] = [
  { action: 'Sort your rack', pointer: 'Click or tap Color or Number above the rack. It works on any turn, and only you see the order.' },
  { action: 'Move a tile in your rack', pointer: 'Click or tap a rack tile to pick it up, then click or tap the tile to put it in front of, or End of rack. Or drag it there. It works on any turn.', keys: 'Tab to a tile, then Enter or Space to pick it up, and Enter or Space on the tile to go in front of.' },
  { action: 'Put a tile on the table', pointer: 'On your turn, click or tap a tile to pick it up, then click or tap the tile it goes in front of, the + at the end of a group, or New group. Or drag it to one of those places. A tile dropped anywhere else goes back.', keys: 'Tab to a tile, then Enter or Space to pick it up, and Enter or Space on a place to put it.' },
  { action: 'Put a held tile down', pointer: 'Click or tap the held tile again.', keys: 'Enter or Space on the held tile.' },
  { action: 'Move a whole group', pointer: 'On your turn, click or tap a group\'s handle (the dotted grip) to pick up the group, then click or tap the + at the end of another group. Or drag the handle there.', keys: 'Enter or Space on the handle, then on the +.' },
  { action: 'Split a group', pointer: 'On your turn, click or tap the thin bar between two of its tiles.' },
  { action: 'Play your tiles', pointer: 'Click or tap Play once every group is valid. The line under your rack says what is wrong.' },
  { action: 'Save an arrangement', pointer: 'Click or tap Save while every group is valid.' },
  { action: 'Go back to an arrangement', pointer: 'Click or tap Reset to return to your saved arrangement, or to the start of your turn if you saved none.' },
  { action: 'Draw a tile', pointer: 'On your turn, click or tap Draw a tile. It ends your turn, and it says Pass once the pool is empty.' },
  { action: 'Ask to take back the last turn', pointer: 'Click or tap Undo. It happens only if every player still in the game approves.' }
];
