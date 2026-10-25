// The landing page's view of hearts: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { HEARTS_RULES } from './options.ts';

export const heartsInfo: GameInfo = {
  id: 'hearts',
  category: 'card',
  name: 'Hearts',
  description: 'Dodge the hearts and the queen of spades, or shoot the moon and take them all',
  minPlayers: 4,
  maxPlayers: 4,
  houseRules: HEARTS_RULES
};
