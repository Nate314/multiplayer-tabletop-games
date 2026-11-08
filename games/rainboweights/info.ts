// The landing page's view of rainboweights: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { RAINBOWEIGHTS_RULES } from './options.ts';

export const rainboweightsInfo: GameInfo = {
  id: 'rainboweights',
  category: 'card',
  name: 'Rainbow Eights',
  description: 'Match colors and numbers, empty your hand and be first to the target score (500 unless the host chose another)',
  minPlayers: 2,
  maxPlayers: 8,
  houseRules: RAINBOWEIGHTS_RULES,
  stretchedPlayers: { min: 2, max: 10 }
};
