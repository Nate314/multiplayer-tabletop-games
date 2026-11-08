import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { initPhysics } from './physics.ts';
import {
  applyAction, applyMove, createGameState, blocktowerStandings, onPlayerDisconnected, onPlayerLeft, onUndo, resetLobby, resumeClock, simulate,
  simulating, toPublicState,
} from './rules.ts';
import { blocktowerInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

// The server and tests load the WASM before any tick; the browser never imports this file
await initPhysics();

export const blocktower: GameDefinition<GameState, PublicGameState> = {
  info: blocktowerInfo,
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
  finalStandings: blocktowerStandings,
  secretState: state => seatFields(state, ['grip'])
};
