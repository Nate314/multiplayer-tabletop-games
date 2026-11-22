// The landing page's view of Tri-Tiles: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { TRITILES_RULES } from './options.ts';

export const tritilesInfo: GameInfo = {
  id: 'tritiles',
  category: 'tile',
  name: 'Tri-Tiles',
  description: 'Match corner numbers to lay triangle tiles, build hexagons and bridges, and play out your hand',
  minPlayers: 2,
  maxPlayers: 6,
  houseRules: TRITILES_RULES
};
