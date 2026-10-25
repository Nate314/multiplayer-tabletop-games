// The landing page's view of uno: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { UNO_RULES } from './options.ts';

export const unoInfo: GameInfo = {
  id: 'uno',
  category: 'card',
  name: 'UNO',
  description: 'Match colors and numbers, empty your hand and be first to the target score (500 unless the host chose another)',
  minPlayers: 2,
  maxPlayers: 8,
  houseRules: UNO_RULES,
  stretchedPlayers: { min: 2, max: 10 }
};
