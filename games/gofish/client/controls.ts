import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (the ask picks, Ask, Undo), Hand.tsx (the cards of a rank) and Table.tsx (the player buttons)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Pick the rank to ask for',
    pointer: 'On your turn, click or tap a card in your hand. All your cards of that rank are picked.'
  },
  {
    action: 'Pick the player to ask',
    pointer: 'Click or tap a player who still has cards. With only one such player, they are picked for you.'
  },
  { action: 'Ask', pointer: 'Click or tap Ask once a rank and a player are picked.' },
  { action: 'Ask to take back the last ask', pointer: 'Click or tap Undo. It happens only if every connected player approves.' }
];
