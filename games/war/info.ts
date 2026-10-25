// The landing page's view of war: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const warInfo: GameInfo = {
  id: 'war',
  category: 'card',
  name: 'War',
  description: 'Flip cards, higher card takes both, and win the whole deck',
  minPlayers: 2,
  maxPlayers: 2
};
