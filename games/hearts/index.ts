import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { heartsInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const hearts: GameDefinition<GameState, PublicGameState> = {
  info: heartsInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  toPublicState,
  finalStandings
};
