// The landing page's view of fourinarow: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const fourinarowInfo: GameInfo = {
  id: 'fourinarow',
  category: 'classic',
  name: 'Four in a Row',
  description: 'Drop discs into the grid and line up four in a row',
  minPlayers: 2,
  maxPlayers: 2
};
