// The landing page's view of catan: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { PLAYERS, CATAN_RULES, SPECIAL_BUILD } from './options.ts';

export const catanInfo: GameInfo = {
  id: 'catan',
  category: 'strategy',
  name: 'Catan',
  description: 'Settle an island, trade resources and build your way to the points to win (10 unless the host chose another)',
  ...PLAYERS,
  houseRules: [...CATAN_RULES, SPECIAL_BUILD]
};
