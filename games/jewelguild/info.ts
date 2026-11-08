// The landing page's view of jewelguild: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { JEWELGUILD_RULES } from './options.ts';

export const jewelguildInfo: GameInfo = {
  id: 'jewelguild',
  category: 'strategy',
  name: 'Jewel Guild',
  description: 'Collect gems, buy development cards and attract nobles to reach the prestige to win (15 unless the host chose another)',
  minPlayers: 2,
  maxPlayers: 4,
  houseRules: JEWELGUILD_RULES
};
