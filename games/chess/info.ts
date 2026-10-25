// The landing page's view of chess: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { CHESS_RULES } from './options.ts';

export const chessInfo: GameInfo = {
  id: 'chess',
  category: 'classic',
  name: 'Chess',
  description: 'Checkmate the enemy king in the classic two-player strategy game',
  minPlayers: 2,
  maxPlayers: 2,
  houseRules: CHESS_RULES
};
