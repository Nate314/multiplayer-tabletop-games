// The landing page's view of rummikub: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { RUMMIKUB_RULES } from './options.ts';

export const rummikubInfo: GameInfo = {
  id: 'rummikub',
  category: 'tile',
  name: 'Rummikub',
  description: 'Lay down sets and runs of numbered tiles and rearrange the table to empty your rack',
  minPlayers: 2,
  maxPlayers: 4,
  houseRules: RUMMIKUB_RULES
};
