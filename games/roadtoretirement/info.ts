// The landing page's view of Road to Retirement: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { ROAD_RULES } from './options.ts';

export const roadtoretirementInfo: GameInfo = {
  id: 'roadtoretirement',
  category: 'classic',
  name: 'Road to Retirement',
  description: 'Choose college or work, build a career and a family, and retire the richest',
  minPlayers: 2,
  maxPlayers: 6,
  houseRules: ROAD_RULES
};
