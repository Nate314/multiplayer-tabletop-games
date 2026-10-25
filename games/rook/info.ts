// The landing page's view of rook: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { ROOK_RULES } from './options.ts';

export const rookInfo: GameInfo = {
  id: 'rook',
  category: 'card',
  name: 'Rook',
  description: 'Bid, take the nest, name trump and win tricks with your partner to the target score (500 unless the host chose another)',
  minPlayers: 4,
  maxPlayers: 4,
  stretchedPlayers: { min: 4, max: 7 }, // 6 in fixed teams; 5 and 7 with called partners
  houseRules: ROOK_RULES
};
