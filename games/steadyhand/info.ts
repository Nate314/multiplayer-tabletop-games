// The landing page's view of Steady Hand: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { STEADYHAND_RULES } from './options.ts';

export const steadyhandInfo: GameInfo = {
  id: 'steadyhand',
  category: 'party',
  name: 'Steady Hand',
  description: 'Steer each part out of its twisting slot without touching the walls',
  minPlayers: 1,
  maxPlayers: 8,
  houseRules: STEADYHAND_RULES
};
