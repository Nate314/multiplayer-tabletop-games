// The landing page's view of pawnsandwalls: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const pawnsandwallsInfo: GameInfo = {
  id: 'pawnsandwalls',
  category: 'classic',
  name: 'Pawns and Walls',
  description: 'Race your pawn to the far side and block opponents with walls',
  minPlayers: 2,
  maxPlayers: 4
};
