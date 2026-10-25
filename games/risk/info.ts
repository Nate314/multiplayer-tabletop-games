// The landing page's view of risk: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const riskInfo: GameInfo = {
  id: 'risk',
  category: 'strategy',
  name: 'Risk',
  description: 'Raise armies, roll for battles and conquer all 42 territories of the world',
  minPlayers: 3,
  maxPlayers: 6
};
