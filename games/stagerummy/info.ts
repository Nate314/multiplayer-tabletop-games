// The landing page's view of stagerummy: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { STAGERUMMY_RULES } from './options.ts';

export const stagerummyInfo: GameInfo = {
  id: 'stagerummy',
  category: 'card',
  name: 'Stage Rummy',
  description: 'Collect sets and runs to complete ten phases first',
  minPlayers: 2,
  maxPlayers: 6,
  houseRules: STAGERUMMY_RULES,
  stretchedPlayers: { min: 2, max: 8 }
};
