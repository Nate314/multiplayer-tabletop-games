import type { GameDefinition } from '../../shared/gameDefinition.ts';
import {
  applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, onUndo, resetLobby, toPublicState
} from './rules.ts';
import { dominoesInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const dominoes: GameDefinition<GameState, PublicGameState> = {
  info: dominoesInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  onUndo,
  toPublicState,
  finalStandings
};
