import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState, waitingOn } from './rules.ts';
import { nestInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const nest: GameDefinition<GameState, PublicGameState> = {
  info: nestInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  waitingOn,
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['hand', 'discards']),
  finalStandings,
  secretState: state => seatFields(state, ['nest', 'captured'])
};
