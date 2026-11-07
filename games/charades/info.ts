// The landing page's view of charades: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { CHARADES_RULES } from './options.ts';

export const charadesInfo: GameInfo = {
  id: 'charades',
  category: 'party',
  name: 'Charades',
  description: 'Act out a prompt on camera while everyone else races to guess it in the chat',
  minPlayers: 2,
  maxPlayers: 10,
  houseRules: CHARADES_RULES,
  ownTurnLimit: true, // its own time per turn
  passAndPlay: false // the actor's prompt would show to the guessers sharing the device
};
