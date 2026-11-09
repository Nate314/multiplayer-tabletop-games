// The landing page's view of drawandguess: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { DRAWANDGUESS_RULES } from './options.ts';

export const drawandguessInfo: GameInfo = {
  id: 'drawandguess',
  category: 'party',
  name: 'Draw and Guess',
  description: 'Draw a word while everyone else races to guess it in the chat',
  minPlayers: 2,
  maxPlayers: 10,
  houseRules: DRAWANDGUESS_RULES,
  ownTurnLimit: true, // its own time per turn
  passAndPlay: false // the drawer's word would show to the guessers sharing the device
};
