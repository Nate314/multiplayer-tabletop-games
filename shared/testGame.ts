import type { GameDefinition } from './gameDefinition.ts';
import type { ChoiceRule, ToggleRule } from './houseRules.ts';
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

const FAST: ToggleRule = { id: 'fast', label: 'Fast', kind: 'toggle', standard: false };
const GOAL: ChoiceRule<number> = {
  id: 'goal', label: 'Goal', kind: 'choice', standard: 3, choices: [{ value: 3, label: '3' }, { value: 5, label: '5' }]
};
const BIG: ToggleRule = { id: 'big', label: 'Big', kind: 'toggle', standard: false, offered: seats => seats >= 3 };
const BIGGER: ToggleRule = {
  id: 'bigger', label: 'Bigger', kind: 'toggle', standard: false, offered: (seats, values) => seats >= 3 && values.big === true
};

// testGame with house rules and a stretched table size
export const rulesGame: GameDefinition<TestState, TestPublicState> = {
  ...testGame,
  info: { ...testGame.info, houseRules: [FAST, GOAL, BIG, BIGGER], stretchedPlayers: { min: 2, max: 6 } }
};

export const TURN_MS = 1000;
export type TimedState = TestState & { turnEndsAt: number | null };

const ticking = (state: TimedState, now: number): TimedState =>
  ({ ...state, turnEndsAt: state.isGameOver ? null : now + TURN_MS });

// rulesGame with a turn clock: each turn lasts TURN_MS, and running out passes the turn
export const timedGame: GameDefinition<TimedState, TestPublicState> = {
  ...(rulesGame as unknown as GameDefinition<TimedState, TestPublicState>),
  createGameState: gameId => ({ ...rulesGame.createGameState(gameId), turnEndsAt: null }),
  applyMove(state, seat, move, random, now): Result<TimedState> {
    const result = rulesGame.applyMove(state, seat, move, random, now);
    return 'error' in result ? result : { state: ticking(result.state as TimedState, now) };
  },
  deadline: state => state.turnEndsAt,
  onDeadline(state, now): TimedState {
    const seat = state.currentPlayer ?? state.activePlayers[0];
    const next = { ...state, currentPlayer: nextActivePlayer(state, seat), gameStatus: `${state.playerNames[seat]} ran out of time` };
    return ticking(next, now);
  },
  resumeClock: ticking
};
