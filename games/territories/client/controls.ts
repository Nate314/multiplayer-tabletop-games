import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (select, the Your armies tray and its drag, Undo), PhasePanel.tsx (the step, dice,
// slider and turn buttons), CardHand.tsx (the trade) and WorldMap.tsx (a territory's Enter and Space handler)
export const CONTROLS: ControlItem[] = [
  { action: 'Place armies', pointer: 'On your turn in setup or reinforcing, click or tap one of your territories to add armies, or drag armies from the Your armies tray onto it. Choose 1, 5 or All for each click.', keys: 'Tab to a territory, then Enter or Space. Escape while dragging puts it back.' },
  { action: 'Take armies back', pointer: 'Click or tap -1 beside a territory in the list. Clear takes back all of them.' },
  { action: 'Confirm your placement', pointer: 'Click or tap Place all in setup, or Place when reinforcing. It says Place and attack when you place the last army.' },
  { action: 'Trade in cards', pointer: 'When reinforcing, click or tap three cards that make a set, then click or tap Trade.' },
  { action: 'Choose an attack', pointer: 'On your turn, click or tap one of your territories with 2 or more armies, then a highlighted enemy territory. Click or tap Clear choice to start again.', keys: 'Tab to a territory, then Enter or Space.' },
  { action: 'Attack', pointer: 'Click or tap a number of dice, then Roll or Blitz. Blitz rolls the most dice until the territory falls or you have 1 army left.' },
  { action: 'Move in after a capture', pointer: 'Move the slider, then click or tap Move.', keys: 'Tab to the slider and use the arrow keys.' },
  { action: 'Fortify', pointer: 'Click or tap Stop attacking and fortify, then one of your territories and a highlighted one connected to it. Move the slider, then click or tap Move and end turn.', keys: 'Tab to a territory, then Enter or Space. Tab to the slider and use the arrow keys.' },
  { action: 'End your turn', pointer: 'Click or tap End turn.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' }
];
