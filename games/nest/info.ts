// The landing page's view of nest: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { NEST_RULES } from './options.ts';

export const nestInfo: GameInfo = {
  id: 'nest',
  category: 'card',
  name: 'Nest',
  description: 'Bid, take the nest, name trump and win tricks with your partner to the target score (500 unless the host chose another)',
  minPlayers: 4,
  maxPlayers: 4,
  stretchedPlayers: { min: 4, max: 7 }, // 6 in fixed teams; 5 and 7 with called partners
  houseRules: NEST_RULES
};
