import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby, toPublicState, waitingOn } from './rules.ts';
import { euchreInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const euchre: GameDefinition<GameState, PublicGameState> = {
  info: euchreInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  applyAction,
  waitingOn,
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['hand', 'discard']),
  finalStandings,
  secretState: state => seatFields(state, ['kitty'])
};
