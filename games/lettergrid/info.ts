// The landing page's view of lettergrid: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { LETTERGRID_RULES } from './options.ts';

export const lettergridInfo: GameInfo = {
  id: 'lettergrid',
  category: 'tile',
  name: 'Letter Grid',
  description: 'Build crossing words from your letter tiles on the premium-square board',
  minPlayers: 2,
  maxPlayers: 4,
  houseRules: LETTERGRID_RULES
};
