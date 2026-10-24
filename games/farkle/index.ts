import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { FARKLE_RULES, applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const farkle: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'farkle',
    category: 'dice',
    name: 'Farkle',
    description: 'Roll six dice, bank your points or push your luck and risk them all',
    minPlayers: 2,
    maxPlayers: 8,
    houseRules: FARKLE_RULES,
    stretchedPlayers: { min: 2, max: 10 }
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState
};
