// The landing page's view of fivedice: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const fivediceInfo: GameInfo = {
  id: 'fivedice',
  category: 'dice',
  name: 'Five Dice',
  description: 'Roll five dice up to three times and fill every scoring box',
  minPlayers: 2,
  maxPlayers: 8,
  stretchedPlayers: { min: 2, max: 10 }
};
