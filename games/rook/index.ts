import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { ROOK_RULES, applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const rook: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'rook',
    category: 'card',
    name: 'Rook',
    description: 'Bid, take the nest, name trump and win tricks with your partner to 500',
    minPlayers: 4,
    maxPlayers: 4,
    houseRules: ROOK_RULES
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  toPublicState
};
