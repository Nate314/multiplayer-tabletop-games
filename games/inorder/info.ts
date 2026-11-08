// The landing page's view of inorder: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { IN_ORDER_RULES } from './options.ts';

export const inorderInfo: GameInfo = {
  id: 'inorder',
  category: 'card',
  name: 'In Order',
  description: 'Draw and swap cards to put your ten-slot rack in order',
  minPlayers: 2,
  maxPlayers: 4,
  houseRules: IN_ORDER_RULES
};
