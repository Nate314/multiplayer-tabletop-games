// The landing page's view of tickettoride: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const tickettorideInfo: GameInfo = {
  id: 'tickettoride',
  category: 'strategy',
  name: 'Ticket to Ride',
  description: 'Collect train cards, claim railway routes across the USA and connect your destination tickets',
  minPlayers: 2,
  maxPlayers: 5
};
