// The landing page's view of fictionary: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { FICTIONARY_RULES } from './options.ts';

export const fictionaryInfo: GameInfo = {
  id: 'fictionary',
  category: 'party',
  name: 'Fictionary',
  description: 'Invent a believable definition for a rare word, then spot the real one',
  minPlayers: 3,
  maxPlayers: 8,
  houseRules: FICTIONARY_RULES,
  ownTurnLimit: true, // its own writing and voting clocks
  passAndPlay: false // every player writes in secret
};
