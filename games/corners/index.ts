import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, finalStandings, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { cornersInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const corners: GameDefinition<GameState, PublicGameState> = {
  info: cornersInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState,
  finalStandings
};
