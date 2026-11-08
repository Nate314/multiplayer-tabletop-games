// The landing page's view of territories: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const territoriesInfo: GameInfo = {
  id: 'territories',
  category: 'strategy',
  name: 'Territories',
  description: 'Raise armies, roll for battles and conquer all 42 territories',
  minPlayers: 3,
  maxPlayers: 6
};
