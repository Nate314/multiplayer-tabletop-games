// The landing page's view of farkle: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { FARKLE_RULES } from './options.ts';

export const farkleInfo: GameInfo = {
  id: 'farkle',
  category: 'dice',
  name: 'Farkle',
  description: 'Roll six dice, bank your points or push your luck and risk them all',
  minPlayers: 2,
  maxPlayers: 8,
  houseRules: FARKLE_RULES,
  stretchedPlayers: { min: 2, max: 10 }
};
