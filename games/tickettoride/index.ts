import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import type { GameState, PublicGameState } from './types.ts';

export const tickettoride: GameDefinition<GameState, PublicGameState> = {
  info: {
    id: 'tickettoride',
    name: 'Ticket to Ride',
    description: 'Collect train cards, claim railway routes across the USA and connect your destination tickets',
    minPlayers: 2,
    maxPlayers: 5
  },
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState
};
