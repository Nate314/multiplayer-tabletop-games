import type { GameDefinition } from './gameDefinition.ts';
import { asRecord } from './messages.ts';
import { baseGameState, nextActivePlayer } from './seating.ts';
import type { BaseGameState, BasePublicState, Result, Seat } from './types.ts';

// A fake game for platform tests: every valid move is a tick, and the third tick wins.
// `secret` is hidden from everyone; `viewer` echoes who the view was built for.
export type TestState = BaseGameState & { moves: number; secret: string };
export type TestPublicState = BasePublicState & { moves: number; viewer: Seat | null };

const WINNING_MOVES = 3;

export const testGame: GameDefinition<TestState, TestPublicState> = {
  info: { id: 'test', name: 'Test', description: 'A fake game for platform tests', category: 'classic', minPlayers: 2, maxPlayers: 4 },

  createGameState: gameId => ({ ...baseGameState(gameId), moves: 0, secret: 'hidden' }),

  resetLobby: state => state,

  applyMove(state, seat, move): Result<TestState> {
    if (asRecord(move)?.type !== 'tick') return { error: 'Invalid move' };
    const moves = state.moves + 1;
    const next: TestState = { ...state, moves, gameStatus: `${state.playerNames[seat]} ticked` };
    if (moves >= WINNING_MOVES) {
      return { state: { ...next, isGameOver: true, currentPlayer: null, winners: [seat] } };
    }
    return { state: { ...next, currentPlayer: nextActivePlayer(next, seat) } };
  },

  applyAction(state, seat, action): Result<TestState> {
    const type = asRecord(action)?.type;
    if (type === 'concede') { // stands in for resigning
      const winners = state.activePlayers.filter(player => player !== seat);
      return { state: { ...state, isGameOver: true, currentPlayer: null, winners, gameStatus: `${state.playerNames[seat]} conceded` } };
    }
    if (type !== 'ping') return { error: 'Unknown action' };
    return { state: { ...state, gameStatus: `${state.playerNames[seat]} pinged` } };
  },

  toPublicState(state, undoAvailable, viewer) {
    const { secret: _secret, ...view } = state;
    return { ...view, undoAvailable, viewer };
  }
};
