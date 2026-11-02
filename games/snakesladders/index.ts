import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, finalStandings, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { snakesladdersInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const snakesladders: GameDefinition<GameState, PublicGameState> = {
  info: snakesladdersInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState,
  finalStandings
};
