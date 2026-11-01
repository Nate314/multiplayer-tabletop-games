// The landing page's view of code breaker: loaded eagerly by the browser, so it imports no rules code
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { CODEBREAKER_RULES } from './options.ts';

export const codebreakerInfo: GameInfo = {
  id: 'codebreaker',
  category: 'puzzle',
  name: 'Code Breaker',
  description: 'Work out the hidden row of colored pegs from the clues each guess earns',
  minPlayers: 1,
  maxPlayers: 6,
  houseRules: CODEBREAKER_RULES,
  ownTurnLimit: true,
  passAndPlay: false // Race boards and Together's any-time play do not fit one shared device
};
