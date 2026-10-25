// The landing page's view of thecrew: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const thecrewInfo: GameInfo = {
  id: 'thecrew',
  category: 'card',
  name: 'The Crew',
  description: 'Work together to complete mission tasks in a trick-taking game with little talking',
  minPlayers: 3,
  maxPlayers: 5
};
