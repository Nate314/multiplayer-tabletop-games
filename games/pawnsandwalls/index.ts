import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { pawnsandwallsInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const pawnsandwalls: GameDefinition<GameState, PublicGameState> = {
  info: pawnsandwallsInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState
};
