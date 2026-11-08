// The landing page's view of whodunit: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';

export const whodunitInfo: GameInfo = {
  id: 'whodunit',
  category: 'classic',
  name: 'Whodunit',
  description: 'Move through a seaside hotel, make suggestions and be first to name who, with what and where',
  minPlayers: 3,
  maxPlayers: 6,
  passAndPlay: false // hands are secret
};
