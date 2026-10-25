import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { spadesInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const spades: GameDefinition<GameState, PublicGameState> = {
  info: spadesInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  toPublicState,
  finalStandings
};
