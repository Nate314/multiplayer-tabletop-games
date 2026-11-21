import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to Table.tsx (the supply gems, the market cards, the decks), PlayerPanel.tsx (your reserved cards),
// selection.ts (what a second click on a gem does), TurnPanel.tsx (Take gems, Buy, Reserve, Cancel, Pass, the return
// and noble panels) and GameScreen.tsx (Undo)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Pick gems to take',
    pointer: 'On your turn, click or tap gems in the supply to pick them, up to three different colors. ' +
      'Click or tap a lone picked color again to take two of it, when 4 or more are left. ' +
      'Click or tap a picked gem again to put it back. Gold cannot be picked.'
  },
  { action: 'Take the picked gems', pointer: 'Click or tap Take gems, or Cancel to put them all back.' },
  { action: 'Pick a card to buy or reserve', pointer: 'Click or tap a face-up card in the market, or one of your reserved cards.' },
  { action: 'Buy the picked card', pointer: 'Click or tap Buy.' },
  {
    action: 'Reserve a card',
    pointer: 'Click or tap a face-up card in the market and then Reserve. ' +
      'To reserve the top card of a deck unseen, click or tap the deck and then Reserve. Cancel puts the pick back.'
  },
  { action: 'Give tokens back', pointer: 'When you hold more than 10, click or tap Return 1 on a color to give one back, or Keep to undo that, then click or tap Return.' },
  { action: 'Choose a noble', pointer: 'When several nobles want to visit, click or tap the one you want.' },
  { action: 'Pass', pointer: 'When you can do nothing else, click or tap Pass.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every player still in the game approves.' }
];
