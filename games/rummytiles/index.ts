import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seatFields } from '../../shared/spectators.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { applyMove, createGameState, finalStandings, onPlayerLeft, resetLobby, toPublicState } from './rules.ts';
import { rummytilesInfo } from './info.ts';
import type { GameState, PublicGameState } from './types.ts';

export const rummytiles: GameDefinition<GameState, PublicGameState> = {
  info: rummytilesInfo,
  createGameState,
  resetLobby,
  onPlayerLeft,
  applyMove,
  onUndo: (state, random) => ({ ...state, pool: shuffle(state.pool, random) }),
  toPublicState,
  privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['rack']),
  finalStandings,
  secretState: state => seatFields(state, ['pool'])
};
