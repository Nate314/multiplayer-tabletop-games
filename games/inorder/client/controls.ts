import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (Undo, the hint), Table.tsx (the two piles, the rack slots, Discard) and
// src/components/RoundSummaryDialog.tsx via RoundSummary.tsx (Continue)
export const CONTROLS: ControlItem[] = [
  { action: 'Draw a card', pointer: 'On your turn, click or tap the draw pile or the discard pile.' },
  {
    action: 'Swap a card into your rack',
    pointer: 'After drawing, click or tap a slot in your rack. The card you took goes in, and the card that was there goes on the discard pile.'
  },
  { action: 'Discard the card you drew', pointer: 'After drawing from the draw pile, click or tap Discard.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' },
  { action: 'Go on to the next round', pointer: 'Click or tap Continue on the scoring screen.' }
];
