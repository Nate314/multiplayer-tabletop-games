// The landing page's view of quoridor: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const quoridorInfo: GameInfo = {
  id: 'quoridor',
  category: 'classic',
  name: 'Quoridor',
  description: 'Race your pawn to the far side and block opponents with walls',
  minPlayers: 2,
  maxPlayers: 4
};
