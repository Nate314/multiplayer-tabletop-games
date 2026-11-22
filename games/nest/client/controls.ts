import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (the bid list and buttons, pick, Lay aside, the trump buttons, Undo), CallPartner.tsx
// and RoundSummary.tsx via src/components/RoundSummaryDialog.tsx (Continue)
export const CONTROLS: ControlItem[] = [
  { action: 'Bid', pointer: 'On your turn in the bidding, choose an amount in the Bid list, then click or tap Bid. The list starts at the lowest bid allowed.' },
  { action: 'Pass in the bidding', pointer: 'On your turn in the bidding, click or tap Pass.' },
  {
    action: 'Lay cards aside',
    pointer: 'If you won the bid, click or tap cards in your hand to pick them, as many as the nest held, and a picked card again to unpick it. Then click or tap Lay aside.'
  },
  { action: 'Name trump', pointer: 'After laying cards aside, click or tap a color.' },
  {
    action: 'Call a partner',
    pointer: 'With five or seven players, the bidder chooses each called card in its list, then clicks or taps Call.'
  },
  { action: 'Play a card', pointer: 'On your turn, click or tap one of your outlined cards.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' },
  { action: 'Go on to the next hand', pointer: 'Click or tap Continue on the scoring screen.' }
];
