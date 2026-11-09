// The landing page's view of hexisland: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { PLAYERS, HEXISLAND_RULES, SPECIAL_BUILD } from './options.ts';

export const hexislandInfo: GameInfo = {
  id: 'hexisland',
  category: 'strategy',
  name: 'Hex Island',
  description: 'Settle an island, trade resources and build your way to the points to win (10 unless the host chose another)',
  ...PLAYERS,
  houseRules: [...HEXISLAND_RULES, SPECIAL_BUILD]
};
