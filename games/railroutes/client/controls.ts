import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (the map's onRoute, Undo), Market.tsx (the cards and decks), TurnPanel.tsx (ticket
// choice, claim payment, Pass), MapBoard.tsx (a route's Enter and Space handler) and HandPanel.tsx (ticket hover and focus)
export const CONTROLS: ControlItem[] = [
  { action: 'Choose which destination tickets to keep', pointer: 'Click or tap the tickets to untick or tick them, then click or tap Keep. Keep at least the number the panel says.' },
  { action: 'See where a ticket runs', pointer: 'Point at a ticket, in your hand or in an offer, to ring its two cities on the map.', keys: 'Tab to a ticket to ring its two cities.' },
  { action: 'Take train cards', pointer: 'On your turn, click or tap a face-up card or the deck, twice. A face-up locomotive is your whole draw.' },
  { action: 'Claim a route', pointer: 'On your turn, click or tap the route on the map, then click or tap a way to pay. Click or tap Cancel, or the route again, to drop the choice.', keys: 'Tab to a route, then Enter or Space to pick it.' },
  { action: 'Draw destination tickets', pointer: 'On your turn, click or tap the Tickets deck.' },
  { action: 'Pass', pointer: 'Click or tap Pass. It shows only when you can neither draw nor claim.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' }
];
