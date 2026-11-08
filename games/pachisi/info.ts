// The landing page's view of pachisi: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const pachisiInfo: GameInfo = {
  id: 'pachisi',
  category: 'classic',
  name: 'Pachisi',
  description: 'Roll two dice and race your four pawns around the cross to home',
  minPlayers: 2,
  maxPlayers: 4
};
