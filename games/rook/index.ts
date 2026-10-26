import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { rookInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const rook: GameDefinition<GameState, PublicGameState> = {
  info: rookInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['hand', 'discards']),
  finalStandings
};
