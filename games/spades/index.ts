import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const spades: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'spades',
    name: 'Spades',
    description: 'Bid your tricks with your partner, spades are always trump',
    minPlayers: 4,
    maxPlayers: 4
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  toPublicState
};
