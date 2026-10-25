// The landing page's view of checkers: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const checkersInfo: GameInfo = {
  id: 'checkers',
  category: 'classic',
  name: 'Checkers',
  description: 'Jump diagonally to capture, and crown a king on the far row',
  minPlayers: 2,
  maxPlayers: 2
};
