// The landing page's view of palacewalls: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const palacewallsInfo: GameInfo = {
  id: 'palacewalls',
  category: 'tile',
  name: 'Palace Walls',
  description: 'Draft colored tiles and decorate your palace wall',
  minPlayers: 2,
  maxPlayers: 4
};
