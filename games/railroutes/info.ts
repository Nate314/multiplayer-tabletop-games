// The landing page's view of railroutes: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const railroutesInfo: GameInfo = {
  id: 'railroutes',
  category: 'strategy',
  name: 'Rail Routes',
  description: 'Collect train cards, claim railway routes across the USA and connect your destination tickets',
  minPlayers: 2,
  maxPlayers: 5
};
