// The landing page's view of connectfour: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const connectfourInfo: GameInfo = {
  id: 'connectfour',
  category: 'classic',
  name: 'Connect Four',
  description: 'Drop discs into the grid and line up four in a row',
  minPlayers: 2,
  maxPlayers: 2
};
