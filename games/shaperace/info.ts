// The landing page's view of Shape Race: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { SHAPERACE_RULES } from './options.ts';

export const shaperaceInfo: GameInfo = {
  id: 'shaperace',
  category: 'party',
  name: 'Shape Race',
  description: 'Race to fit every shape into its hole before the board pops',
  minPlayers: 1,
  maxPlayers: 8,
  houseRules: SHAPERACE_RULES,
  ownTurnLimit: true, // there are no turns, only the race timer
  passAndPlay: false // everyone races at once
};
