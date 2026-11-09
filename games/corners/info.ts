// The landing page's view of corners: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { CORNERS_RULES } from './options.ts';

export const cornersInfo: GameInfo = {
  id: 'corners',
  category: 'strategy',
  name: 'Corners',
  description: 'Claim the board one piece at a time, touching your own color only at the corners',
  minPlayers: 2,
  maxPlayers: 4,
  houseRules: CORNERS_RULES
};
