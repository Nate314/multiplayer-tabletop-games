// The landing page's view of yahtzee: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const yahtzeeInfo: GameInfo = {
  id: 'yahtzee',
  category: 'dice',
  name: 'Yahtzee',
  description: 'Roll five dice up to three times and fill every scoring box',
  minPlayers: 2,
  maxPlayers: 8,
  stretchedPlayers: { min: 2, max: 10 }
};
