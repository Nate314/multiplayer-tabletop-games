// The landing page's view of bingo: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { BINGO_RULES } from './options.ts';

export const bingoInfo: GameInfo = {
  id: 'bingo',
  category: 'party',
  name: 'Bingo',
  description: 'Take turns calling numbers, mark your cards and shout Bingo first',
  minPlayers: 2,
  maxPlayers: 12,
  houseRules: BINGO_RULES
};
