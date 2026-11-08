// The landing page's view of blocktower: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { BLOCKTOWER_RULES } from './options.ts';

export const blocktowerInfo: GameInfo = {
  id: 'blocktower',
  category: 'party',
  name: 'Block Tower',
  description: 'Pull blocks from a wobbly tower and stack them on top without knocking it over',
  minPlayers: 2,
  maxPlayers: 8,
  houseRules: BLOCKTOWER_RULES
};
