import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (the hand cards, Pass, Undo) and src/components/RoundSummaryDialog.tsx via
// RoundSummary.tsx (Continue)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Pass three cards',
    pointer: 'Before each hand, click or tap three cards in your hand, and a picked card again to unpick it. ' +
      'Then click or tap Pass.'
  },
  {
    action: 'Play a card',
    pointer: 'On your turn, click or tap a card in your hand. The cards you may play are raised and outlined.'
  },
  { action: 'Ask to take back the last card', pointer: 'Click or tap Undo. It happens only if every connected player approves.' },
  { action: 'Go on to the next hand', pointer: 'Click or tap Continue on the scoring screen.' }
];
