// The landing page's view of rummytiles: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { RUMMYTILES_RULES } from './options.ts';

export const rummytilesInfo: GameInfo = {
  id: 'rummytiles',
  category: 'tile',
  name: 'Rummy Tiles',
  description: 'Lay down sets and runs of numbered tiles and rearrange the table to empty your rack',
  minPlayers: 2,
  maxPlayers: 4,
  houseRules: RUMMYTILES_RULES
};
