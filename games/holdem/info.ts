// The landing page's view of holdem: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const holdemInfo: GameInfo = {
  id: 'holdem',
  category: 'card',
  name: "Texas Hold'em",
  description: 'Two private cards, five shared ones, and betting with play chips',
  minPlayers: 2,
  maxPlayers: 8,
  stretchedPlayers: { min: 2, max: 10 }
};
