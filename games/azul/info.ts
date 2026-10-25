// The landing page's view of azul: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const azulInfo: GameInfo = {
  id: 'azul',
  category: 'tile',
  name: 'Azul',
  description: 'Draft colored tiles and decorate your palace wall',
  minPlayers: 2,
  maxPlayers: 4
};
