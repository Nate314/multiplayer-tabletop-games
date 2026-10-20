import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, onPlayerDisconnected, onPlayerLeft, onUndo, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const thecrew: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'thecrew',
    category: 'card',
    name: 'The Crew',
    description: 'Work together to complete mission tasks in a trick-taking game with little talking',
    minPlayers: 3,
    maxPlayers: 5
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  onUndo,
  applyMove,
  applyAction,
  toPublicState
};
