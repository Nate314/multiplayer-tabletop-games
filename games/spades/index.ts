import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { SPADES_RULES, applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const spades: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'spades',
    category: 'card',
    name: 'Spades',
    description: 'Bid your tricks with your partner, spades are always trump',
    minPlayers: 4,
    maxPlayers: 4,
    houseRules: SPADES_RULES
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  toPublicState
};
