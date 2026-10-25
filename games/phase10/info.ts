// The landing page's view of phase10: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { PHASE10_RULES } from './options.ts';

export const phase10Info: GameInfo = {
  id: 'phase10',
  category: 'card',
  name: 'Phase 10',
  description: 'Collect sets and runs to complete ten phases first',
  minPlayers: 2,
  maxPlayers: 6,
  houseRules: PHASE10_RULES,
  stretchedPlayers: { min: 2, max: 8 }
};
