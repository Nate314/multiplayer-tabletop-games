// The landing page's view of missiontricks: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const missiontricksInfo: GameInfo = {
  id: 'missiontricks',
  category: 'card',
  name: 'Mission Tricks',
  description: 'A cooperative trick-taking game: finish the tasks of each mission as a team while barely talking',
  minPlayers: 3,
  maxPlayers: 5
};
