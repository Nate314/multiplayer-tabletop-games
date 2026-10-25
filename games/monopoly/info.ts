// The landing page's view of monopoly: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { MONOPOLY_RULES } from './options.ts';

export const monopolyInfo: GameInfo = {
  id: 'monopoly',
  category: 'strategy',
  name: 'Monopoly',
  description: 'Buy, trade and build on properties and bankrupt every other player',
  minPlayers: 2,
  maxPlayers: 8,
  houseRules: MONOPOLY_RULES
};
