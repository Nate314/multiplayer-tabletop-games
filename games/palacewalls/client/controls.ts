import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to Factories.tsx (the tile buttons), GameScreen.tsx (place, the drag, Undo), PlayerBoard.tsx (the pattern
// lines and the floor line) and RoundSummary.tsx via src/components/RoundSummaryDialog.tsx (Continue)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Take tiles',
    pointer: 'On your turn, click or tap a tile in a factory or in the center to pick up every tile of that color from that place. ' +
      'Click or tap the tiles again to put them back. Or drag a tile onto one of your lines.'
  },
  {
    action: 'Place the tiles on a pattern line',
    pointer: 'Click or tap an outlined line on your board, or drag the tiles onto it. If you drop them anywhere else, or press Escape while dragging, they stay picked up.'
  },
  { action: 'Send the tiles to the floor line', pointer: 'Click or tap your floor line, or drag the tiles onto it.' },
  { action: 'Ask to take back the last turn', pointer: 'Click or tap Undo. It happens only if every player still in the game approves.' },
  { action: 'Go on to the next round', pointer: 'Click or tap Continue on the scoring screen. The next round is dealt once every player has.' }
];
