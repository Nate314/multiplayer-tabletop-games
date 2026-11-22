import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (the picks, Put back, End turn, Undo), Hand.tsx, Board.tsx (the building piles)
// and PlayerArea.tsx (the stock, the discard piles, the Pile and Discard here buttons)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Pick a card',
    pointer: 'On your turn, click or tap a card in your hand, the top of your stock, or the top of one of your discard piles. ' +
      'Click or tap the card again to unpick it, or another card to pick that one instead.'
  },
  { action: 'Play a card on a building pile', pointer: 'With a card picked, click or tap a highlighted building pile.' },
  {
    action: 'Discard a card and end your turn',
    pointer: 'With a hand card picked, click or tap the Pile button under one of your discard piles, then click or tap Discard here. ' +
      'Click or tap another Pile button to choose that pile instead.'
  },
  { action: 'Put a card back', pointer: 'Click or tap Put back to unpick the card.' },
  { action: 'End your turn with an empty hand', pointer: 'When you have no cards in hand, click or tap End turn.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' }
];
