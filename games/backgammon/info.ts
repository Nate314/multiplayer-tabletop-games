// The landing page's view of backgammon: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const backgammonInfo: GameInfo = {
  id: 'backgammon',
  category: 'classic',
  name: 'Backgammon',
  description: 'Race your fifteen checkers home and bear them off before your opponent',
  minPlayers: 2,
  maxPlayers: 2
};
