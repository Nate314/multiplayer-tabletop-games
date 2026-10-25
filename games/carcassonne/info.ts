// The landing page's view of carcassonne: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const carcassonneInfo: GameInfo = {
  id: 'carcassonne',
  category: 'tile',
  name: 'Carcassonne',
  description: 'Lay land tiles to build cities, roads and fields, and claim them with your meeples',
  minPlayers: 2,
  maxPlayers: 5
};
