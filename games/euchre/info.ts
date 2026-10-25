// The landing page's view of euchre: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { EUCHRE_RULES } from './options.ts';

export const euchreInfo: GameInfo = {
  id: 'euchre',
  category: 'card',
  name: 'Euchre',
  description: 'Make trump with your partner in a fast trick-taking game where jacks are on top',
  minPlayers: 4,
  maxPlayers: 4,
  houseRules: EUCHRE_RULES
};
