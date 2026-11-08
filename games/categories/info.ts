// The landing page's view of categories: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { CATEGORIES_RULES } from './options.ts';

export const categoriesInfo: GameInfo = {
  id: 'categories',
  category: 'party',
  name: 'Categories',
  description: "Name something for every category that starts with the round's letter",
  minPlayers: 2,
  maxPlayers: 8,
  houseRules: CATEGORIES_RULES,
  ownTurnLimit: true, // its own time per round
  passAndPlay: false // answers would show to the players sharing the device
};
