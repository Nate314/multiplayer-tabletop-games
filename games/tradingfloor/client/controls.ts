import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to Hand.tsx (a card is a toggle button while trading, at most 4 picked), GameScreen.tsx (Offer, Withdraw,
// Corner!), OfferBoard.tsx (Accept) and src/components/RoundSummaryDialog.tsx (Continue)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Pick cards to offer',
    pointer: 'While trading, click or tap a card in your hand to pick it, and click or tap a picked card again to put it back. Up to four can be picked.'
  },
  {
    action: 'Make an offer',
    pointer: 'Click or tap Offer, which shows how many cards are picked. If you already have an offer open, pick other cards and click or tap Offer to replace it.'
  },
  { action: 'Take back your offer', pointer: 'Click or tap Withdraw.' },
  { action: 'Accept an offer', pointer: 'Click or tap Accept beside another player\'s offer. It works only while your own open offer has the same number of cards.' },
  { action: 'Corner a commodity', pointer: 'When you can corner, click or tap Corner!. It is off until then.' },
  { action: 'Go on to the next round', pointer: 'Click or tap Continue on the round scoring. New hands are dealt once every connected player has.' }
];
