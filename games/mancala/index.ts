import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, finalStandings, resetLobby, toPublicState } from './rules.ts';
import { mancalaInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const mancala: GameDefinition<GameState, PublicGameState> = {
  info: mancalaInfo,
  createGameState,
  resetLobby,
  applyMove,
  toPublicState,
  finalStandings
};
