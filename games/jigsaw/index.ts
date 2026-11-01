import type { GameDefinition } from '../../shared/gameDefinition.ts';
import {
  allowsUndoVote, applyAction, applyMove, createGameState, finalStandings, imagesOf, onPlayerDisconnected, onPlayerLeft, onUndo,
  recordsAction, resetLobby, toPublicState, undoOwn
} from './rules.ts';
import { jigsawInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const jigsaw: GameDefinition<GameState, PublicGameState> = {
  info: jigsawInfo,
  createGameState,
  resetLobby,
  continuesAlone: true,
  onPlayerLeft,
  onPlayerDisconnected,
  onUndo,
  applyMove,
  applyAction,
  recordsAction,
  undoOwn,
  allowsUndoVote,
  finalStandings,
  toPublicState,
  imagesOf
};
