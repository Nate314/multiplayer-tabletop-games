import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { shuffle } from '../../shared/shuffle.ts';
import {
  allowsOutOfTurn, applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby,
  toPublicState, waitingOn
} from './rules.ts';
import { hexislandInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const hexisland: GameDefinition<GameState, PublicGameState> = {
  info: hexislandInfo,
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
  finalStandings,
  secretState: state => seatFields(state, ['devDeck'])
};
