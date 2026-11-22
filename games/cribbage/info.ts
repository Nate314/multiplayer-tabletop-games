// The landing page's view of cribbage: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { CRIBBAGE_RULES } from './options.ts';

export const cribbageInfo: GameInfo = {
  id: 'cribbage',
  category: 'card',
  name: 'Cribbage',
  description: 'Make fifteens, pairs and runs, peg to 31, and race your pegs around the board',
  minPlayers: 2,
  maxPlayers: 4,
  houseRules: CRIBBAGE_RULES
};
