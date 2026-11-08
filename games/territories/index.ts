import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyMove, createGameState, finalStandings, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { territoriesInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const territories: GameDefinition<GameState, PublicGameState> = {
  info: territoriesInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  onUndo: (state, random) => ({ ...state, deck: shuffle(state.deck, random) }),
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['hand']),
  finalStandings,
  secretState: state => seatFields(state, ['deck'])
};
