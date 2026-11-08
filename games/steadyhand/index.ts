import type { GameDefinition } from '../../shared/gameDefinition.ts';
import {
  applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby, resumeClock, toPublicState
} from './rules.ts';
import { steadyhandInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const steadyhand: GameDefinition<GameState, PublicGameState> = {
  info: steadyhandInfo,
  continuesAlone: true,
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  resumeClock,
  onPlayerDisconnected,
  onPlayerLeft,
  finalStandings,
  toPublicState
};
