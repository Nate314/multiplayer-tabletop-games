import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (Order up or Pick up, Pass, the suit picker, Go alone, Play with partner, the hand
// cards, Undo) and src/components/RoundSummaryDialog.tsx via RoundSummary.tsx (Continue)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Order up the turned card',
    pointer: 'When trump is first offered to you, click or tap Order up to make the turned card\'s suit trump. The dealer sees Pick up instead.'
  },
  { action: 'Pass on making trump', pointer: 'On your turn to make trump, click or tap Pass.' },
  { action: 'Name trump', pointer: 'In the second round of making trump, click or tap the suit you want as trump.' },
  { action: 'Go alone', pointer: 'If you made trump, click or tap Go alone, or Play with partner.' },
  { action: 'Discard a card', pointer: 'If you are the dealer and picked up the turned card, click or tap the card in your hand to discard.' },
  {
    action: 'Play a card',
    pointer: 'On your turn, click or tap a card in your hand. The cards you may play are raised and outlined.'
  },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' },
  { action: 'Go on to the next hand', pointer: 'Click or tap Continue on the scoring screen.' }
];
