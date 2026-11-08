import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { applyMove, createGameState, finalStandings, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { roadtoretirementInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const roadtoretirement: GameDefinition<GameState, PublicGameState> = {
  info: roadtoretirementInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  toPublicState,
  finalStandings
};
