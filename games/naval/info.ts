// The landing page's view of Naval Battle: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { NAVAL_RULES } from './options.ts';

export const navalInfo: GameInfo = {
  id: 'naval',
  category: 'classic',
  name: 'Naval Battle',
  description: 'Hide your fleet on a grid and sink the other fleet first',
  minPlayers: 2,
  maxPlayers: 2,
  houseRules: NAVAL_RULES
};
