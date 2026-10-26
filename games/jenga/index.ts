import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { initPhysics } from './physics.ts';
import {
  applyAction, applyMove, createGameState, jengaStandings, onPlayerDisconnected, onPlayerLeft, onUndo, resetLobby, resumeClock, simulate,
  simulating, toPublicState,
} from './rules.ts';
import { jengaInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

// The server and tests load the WASM before any tick; the browser never imports this file
await initPhysics();

export const jenga: GameDefinition<GameState, PublicGameState> = {
  info: jengaInfo,
  createGameState,
  resetLobby,
  applyMove,
  applyAction,
  onUndo,
  onPlayerLeft,
  onPlayerDisconnected,
  resumeClock,
  simulating,
  simulate,
  toPublicState,
  finalStandings: jengaStandings
};
