// The landing page's view of skipbo: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const skipboInfo: GameInfo = {
  id: 'skipbo',
  category: 'card',
  name: 'Skip-Bo',
  description: 'Build piles from 1 to 12 and be first to empty your stock pile',
  minPlayers: 2,
  maxPlayers: 6
};
