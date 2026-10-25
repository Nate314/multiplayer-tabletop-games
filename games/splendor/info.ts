// The landing page's view of splendor: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { SPLENDOR_RULES } from './options.ts';

export const splendorInfo: GameInfo = {
  id: 'splendor',
  category: 'strategy',
  name: 'Splendor',
  description: 'Collect gems, buy development cards and attract nobles to reach the prestige to win (15 unless the host chose another)',
  minPlayers: 2,
  maxPlayers: 4,
  houseRules: SPLENDOR_RULES
};
