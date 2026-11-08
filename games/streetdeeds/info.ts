// The landing page's view of streetdeeds: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { STREETDEEDS_RULES } from './options.ts';

export const streetdeedsInfo: GameInfo = {
  id: 'streetdeeds',
  category: 'strategy',
  name: 'Street Deeds',
  description: 'Buy up a city street by street, build, trade and bankrupt every other player',
  minPlayers: 2,
  maxPlayers: 8,
  houseRules: STREETDEEDS_RULES
};
