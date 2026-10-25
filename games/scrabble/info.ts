// The landing page's view of scrabble: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { SCRABBLE_RULES } from './options.ts';

export const scrabbleInfo: GameInfo = {
  id: 'scrabble',
  category: 'tile',
  name: 'Scrabble',
  description: 'Build crossing words from your letter tiles on the premium-square board',
  minPlayers: 2,
  maxPlayers: 4,
  houseRules: SCRABBLE_RULES
};
