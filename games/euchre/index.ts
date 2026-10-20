import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const euchre: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'euchre',
    category: 'card',
    name: 'Euchre',
    description: 'Make trump with your partner in a fast trick-taking game where jacks are on top',
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
