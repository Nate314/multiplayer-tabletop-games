// Road to Retirement: the platform's hooks, sending each move to the board in play
import { asRecord } from '../../shared/messages.ts';
import { baseGameState } from '../../shared/seating.ts';
import type { Standing } from '../../shared/types.ts';
import { checkeredLeft, checkeredMove, checkeredStandings, startCheckered } from './checkeredRules.ts';
import { boardOf } from './options.ts';
import { roadLeft, roadMove, roadStandings, startRoad } from './roadRules.ts';
import type { GameState, Move, PublicGameState, Random, Result, Seat } from './types.ts';

const MOVE_TYPES = ['route', 'spin', 'fork', 'career', 'buyHouse', 'step'];

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), board: 'road', road: null, checkered: null, spin: null, lastMove: null };
}

// Runs after every house rule change, so the board chosen in the lobby is the one set up
export function resetLobby(state: GameState): GameState {
  return boardOf(state) === 'checkered' ? startCheckered(state) : startRoad(state);
}

export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  return state.board === 'checkered' ? checkeredLeft(state, seat) : roadLeft(state, seat);
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const type = asRecord(move)?.type;
  if (typeof type !== 'string' || !MOVE_TYPES.includes(type)) return { error: 'Unknown move type' };
  return (state.board === 'checkered' ? checkeredMove : roadMove)(state, seat, move as Move, random);
}

export function finalStandings(state: GameState): Standing[] {
  return state.board === 'checkered' ? checkeredStandings(state) : roadStandings(state);
}
