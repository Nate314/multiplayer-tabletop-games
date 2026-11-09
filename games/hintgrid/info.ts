// The landing page's view of hintgrid: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const hintgridInfo: GameInfo = {
  id: 'hintgrid',
  category: 'party',
  name: 'Hint Grid',
  description: 'Two teams race to find their words on a grid from one-word clues',
  minPlayers: 4,
  maxPlayers: 8,
  passAndPlay: false // the clue-giver's key would show to the guessers sharing the device
};
