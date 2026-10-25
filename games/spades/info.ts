// The landing page's view of spades: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { SPADES_RULES } from './options.ts';

export const spadesInfo: GameInfo = {
  id: 'spades',
  category: 'card',
  name: 'Spades',
  description: 'Bid your tricks with your partner, spades are always trump',
  minPlayers: 4,
  maxPlayers: 4,
  houseRules: SPADES_RULES
};
