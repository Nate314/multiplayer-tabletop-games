import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, finalStandings, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { pachisiInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const pachisi: GameDefinition<GameState, PublicGameState> = {
  info: pachisiInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState,
  finalStandings
};
