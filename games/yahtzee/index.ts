import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, finalStandings, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { yahtzeeInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const yahtzee: GameDefinition<GameState, PublicGameState> = {
  info: yahtzeeInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState,
  finalStandings
};
