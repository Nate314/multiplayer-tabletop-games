// The landing page's view of tictactoe: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const tictactoeInfo: GameInfo = {
  id: 'tictactoe',
  category: 'classic',
  name: 'Tic-Tac-Toe',
  description: 'Take turns marking X and O and get three in a row',
  minPlayers: 2,
  maxPlayers: 2
};
