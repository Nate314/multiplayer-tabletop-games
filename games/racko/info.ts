// The landing page's view of racko: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { RACKO_RULES } from './options.ts';

export const rackoInfo: GameInfo = {
  id: 'racko',
  category: 'card',
  name: 'Rack-O',
  description: 'Draw and swap cards to put your ten-slot rack in order',
  minPlayers: 2,
  maxPlayers: 4,
  houseRules: RACKO_RULES
};
