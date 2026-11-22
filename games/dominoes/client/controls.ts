import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (playTile, playOn, the drag, Draw, Pass, Undo), Table.tsx (the boneyard button),
// Board.tsx (the open-end buttons) and RoundSummary.tsx via src/components/RoundSummaryDialog.tsx (Continue)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Play a tile',
    pointer: 'On your turn, the tiles that fit are raised and outlined. Click or tap one: it is played at once if it fits only one end. ' +
      'Or drag it onto a highlighted open end, or onto the empty board to lead; drop it anywhere else to put it back.',
    keys: 'Escape while dragging puts it back.'
  },
  {
    action: 'Choose the end for a tile',
    pointer: 'When a tile fits more than one end, click or tap it, then click or tap a marked open end on the board or one of the end buttons. ' +
      'Click or tap the tile again, or Cancel, to put it back.'
  },
  { action: 'Draw a tile', pointer: 'When no tile fits, click or tap Draw or the boneyard. Each click takes one tile.' },
  { action: 'Pass', pointer: 'When nothing fits and you cannot draw, click or tap Pass. With Trains, you pass after drawing one tile that does not fit.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' },
  { action: 'Go on to the next round', pointer: 'Click or tap Continue on the scoring screen. The next round is dealt once every connected player has.' }
];
