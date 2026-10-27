import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, finalStandings, resetLobby, toPublicState } from './rules.ts';
import { backgammonInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const backgammon: GameDefinition<GameState, PublicGameState> = {
  info: backgammonInfo,
  createGameState,
  resetLobby,
  applyMove,
  toPublicState,
  finalStandings
};
