import type { GameDefinition } from '../../shared/gameDefinition.ts';
import {
  applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState
} from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const monopoly: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'monopoly',
    name: 'Monopoly',
    description: 'Buy, trade and build on properties and bankrupt every other player',
    minPlayers: 2,
    maxPlayers: 8
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  toPublicState
};
