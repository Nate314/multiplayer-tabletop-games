import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const hearts: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'hearts',
    category: 'card',
    name: 'Hearts',
    description: 'Dodge the hearts and the queen of spades, or shoot the moon and take them all',
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
