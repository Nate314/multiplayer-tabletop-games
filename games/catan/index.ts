import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { shuffle } from '../../shared/shuffle.ts';
import {
  allowsOutOfTurn, applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby,
  toPublicState, waitingOn
} from './rules.ts';
import { catanInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const catan: GameDefinition<GameState, PublicGameState> = {
  info: catanInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  onPlayerDisconnected,
  applyMove,
  allowsOutOfTurn,
  waitingOn,
  applyAction,
  onUndo: (state, random) => ({ ...state, devDeck: shuffle(state.devDeck, random) }),
  toPublicState,
  privateSeatView: (state, seat) => seatFields(
    toPublicState(state, false, seat), ['viewer', 'hand', 'myDevCards', 'myNewDevCards', 'points', 'steal']
  ),
  finalStandings
};
