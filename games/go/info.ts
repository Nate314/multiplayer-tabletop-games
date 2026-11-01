// The landing page's view of Go: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { GO_RULES } from './options.ts';

export const goInfo: GameInfo = {
  id: 'go',
  category: 'strategy',
  name: 'Go',
  description: 'Surround more of the board than your opponent with black and white stones',
  minPlayers: 2,
  maxPlayers: 2,
  houseRules: GO_RULES
};
