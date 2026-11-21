import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (Call, Auto-call, Auto-mark, Undo, Bingo!) and CardGrid.tsx (the squares)
export const CONTROLS: ControlItem[] = [
  { action: 'Call a number', pointer: 'On your turn, click or tap Call.' },
  { action: 'Call automatically', pointer: 'Tick Auto-call. It calls one second after your turn comes up, and it is off again when you reload the page. It works only in your own browser tab. On a shared device it works for every player on it.' },
  { action: 'Mark a number', pointer: 'Click or tap the square on your card. Only a called number can be marked, on any turn.' },
  { action: 'Mark automatically', pointer: 'Tick Auto-mark. It marks every called number and claims Bingo when a card has the pattern, and it is off again when you reload the page. It works only in your own browser tab. On a shared device it works for every player on it.' },
  { action: 'Claim a Bingo', pointer: 'Click or tap Bingo!. On a shared device, each player has their own Bingo! button.' },
  { action: 'Ask to take back the last call', pointer: 'Click or tap Undo. It happens only if every connected player approves.' }
];
