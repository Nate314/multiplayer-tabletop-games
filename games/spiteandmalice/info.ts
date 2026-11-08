// The landing page's view of spiteandmalice: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const spiteandmaliceInfo: GameInfo = {
  id: 'spiteandmalice',  category: 'card',
  name: 'Spite and Malice',
  description: 'Build piles from 1 to 12 and be first to empty your stock pile',
  minPlayers: 2,
  maxPlayers: 6
};
