// The landing page's view of jigsaw: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { JIGSAW_RULES } from './options.ts';

export const jigsawInfo: GameInfo = {
  id: 'jigsaw',
  category: 'puzzle',
  name: 'Jigsaw',
  description: 'Put a picture back together alone, together or in a race',
  minPlayers: 1,
  maxPlayers: 8,
  houseRules: JIGSAW_RULES,
  ownTurnLimit: true, // there are no turns, so the platform turn timer is not offered
  passAndPlay: false // one device has nothing to hand over
};
