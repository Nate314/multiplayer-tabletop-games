import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (the Tricks list, Bid, the hand cards, Undo) and
// src/components/RoundSummaryDialog.tsx via RoundSummary.tsx (Continue)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Bid',
    pointer: 'On your turn to bid, choose the number in Tricks, or Nil to take none, then click or tap Bid.'
  },
  {
    action: 'Play a card',
    pointer: 'On your turn, click or tap a card in your hand. The cards you may play are raised and outlined.'
  },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' },
  { action: 'Go on to the next hand', pointer: 'Click or tap Continue on the scoring screen.' }
];
