// The landing page's view of missiontricks: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const missiontricksInfo: GameInfo = {
  id: 'missiontricks',
  category: 'card',
  name: 'Mission Tricks',
  description: 'Work together to complete mission tasks in a trick-taking game with little talking',
  minPlayers: 3,
  maxPlayers: 5
};
