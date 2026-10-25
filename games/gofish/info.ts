// The landing page's view of gofish: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const gofishInfo: GameInfo = {
  id: 'gofish',
  category: 'card',
  name: 'Go Fish',
  description: 'Ask for ranks, go fish, and collect the most books of four',
  minPlayers: 2,
  maxPlayers: 6
};
