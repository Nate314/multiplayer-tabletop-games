// The landing page's view of dominoes: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { DOMINOES_RULES } from './options.ts';

export const dominoesInfo: GameInfo = {
  id: 'dominoes',
  category: 'tile',
  name: 'Dominoes',
  description: 'Match tile ends to build a line or branches and be first to play out your hand',
  minPlayers: 2,
  maxPlayers: 4,
  houseRules: DOMINOES_RULES
};
