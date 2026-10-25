// The landing page's view of mancala: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { MANCALA_RULES } from './options.ts';

export const mancalaInfo: GameInfo = {
  id: 'mancala',
  category: 'classic',
  name: 'Mancala',
  description: 'Drop stones around the board, play Avalanche or Kalah, and fill your bank',
  minPlayers: 2,
  maxPlayers: 2,
  houseRules: MANCALA_RULES
};
