import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, finalStandings, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { fivediceInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const fivedice: GameDefinition<GameState, PublicGameState> = {
  info: fivediceInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState,
  finalStandings
};
