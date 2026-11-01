// The landing page's view of Chinese Checkers: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const chinesecheckersInfo: GameInfo = {
  id: 'chinesecheckers',
  category: 'classic',
  name: 'Chinese Checkers',
  description: 'Hop your ten marbles across the star into the opposite point',
  minPlayers: 2,
  maxPlayers: 6
};
