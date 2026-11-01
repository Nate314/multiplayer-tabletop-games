// The landing page's view of snakes and ladders: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { SNAKES_LADDERS_RULES } from './options.ts';

export const snakesladdersInfo: GameInfo = {
  id: 'snakesladders',
  category: 'classic',
  name: 'Snakes and Ladders',
  description: 'Roll the die, climb the ladders and dodge the snakes on the way to 100',
  minPlayers: 2,
  maxPlayers: 6,
  houseRules: SNAKES_LADDERS_RULES
};
