import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to Board.tsx (renderPit: a button on each pit you can play) and GameScreen.tsx (Undo)
export const CONTROLS: ControlItem[] = [
  { action: 'Sow a pit', pointer: 'On your turn, click or tap one of your outlined pits, the ones that have stones.' },
  {
    action: 'Sow from the other side',
    pointer: 'With the house rule that lets you play from the other side: when your row is empty on your turn, click or tap an outlined pit on your opponent\'s row.'
  },
  { action: 'Ask to take back the last turn', pointer: 'Click or tap Undo. It happens only if your opponent approves.' }
];
