import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (pick, Send to crib, Cut, Go, Undo), ShowPanel.tsx (Your count, Claim, Muggins!,
// No Muggins, Claim these, Cancel) and RoundSummary.tsx via src/components/RoundSummaryDialog.tsx (Continue)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Lay cards in the crib',
    pointer: 'Everyone does this at once. Click or tap the cards in your hand to pick them, two with two players and one otherwise, ' +
      'and a picked card again to unpick it. Then click or tap Send to crib.'
  },
  { action: 'Cut for the starter', pointer: 'If you are the player after the dealer, click or tap Cut.' },
  { action: 'Play a card', pointer: 'On your turn in the pegging, click or tap a card that keeps the count at 31 or less.' },
  { action: 'Say Go', pointer: 'When none of your cards fit, click or tap Go.' },
  {
    action: 'Claim your count',
    pointer: 'With the Muggins house rule, type your count in Your count (0 to 29), then click or tap Claim.',
    keys: 'In Your count, Enter claims.'
  },
  {
    action: 'Call Muggins',
    pointer: 'With Muggins, when an opponent claims too little, click or tap Muggins! before the clock runs out. ' +
      'In the Name the points style, you then click or tap the cards of a combination they missed, and click or tap Claim these, or Cancel.'
  },
  { action: 'Pass on Muggins', pointer: 'Click or tap No Muggins.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' },
  { action: 'Go on to the next hand', pointer: 'Click or tap Continue on the scoring screen.' }
];
