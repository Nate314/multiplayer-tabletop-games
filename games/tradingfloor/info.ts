// The landing page's view of Trading Floor: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { TRADINGFLOOR_RULES } from './options.ts';

export const tradingfloorInfo: GameInfo = {
  id: 'tradingfloor',
  category: 'card',
  name: 'Trading Floor',
  description: 'Shout out offers and swap cards blind until you corner one commodity',
  minPlayers: 3,
  maxPlayers: 8,
  houseRules: TRADINGFLOOR_RULES,
  ownTurnLimit: true, // there are no turns, so the platform turn timer is not offered
  passAndPlay: false // one device cannot hide eight hands
};
