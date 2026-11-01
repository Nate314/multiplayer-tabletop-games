import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, finalStandings, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { chinesecheckersInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const chinesecheckers: GameDefinition<GameState, PublicGameState> = {
  info: chinesecheckersInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState,
  finalStandings
};
