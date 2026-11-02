// The landing page's view of ultimatetictactoe: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const ultimatetictactoeInfo: GameInfo = {
  id: 'ultimatetictactoe',
  category: 'classic',
  name: 'Ultimate Tic-Tac-Toe',
  description: 'Nine games of tic-tac-toe in one, where every move sends your opponent',
  minPlayers: 2,
  maxPlayers: 2
};
