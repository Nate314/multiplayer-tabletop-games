// The landing page's view of jenga: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { JENGA_RULES } from './options.ts';

export const jengaInfo: GameInfo = {
  id: 'jenga',
  category: 'party',
  name: 'Jenga',
  description: 'Pull blocks from a wobbly tower and stack them on top without knocking it over',
  minPlayers: 2,
  maxPlayers: 8,
  houseRules: JENGA_RULES
};
