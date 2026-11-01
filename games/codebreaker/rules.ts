// Code breaker rules. This file holds the Classic paths: two players alternate as maker and breaker for four rounds.
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { modeOf } from '../../shared/puzzleModes.ts';
import { acknowledge, awaiting } from '../../shared/rounds.ts';
import type { RoundAccess } from '../../shared/rounds.ts';
import { baseGameState } from '../../shared/seating.ts';
import { pointsText, rankStandings } from '../../shared/standings.ts';
import type { Result, Standing } from '../../shared/types.ts';
import { feedback } from './feedback.ts';
import { CODEBREAKER_MODE, CODE_RULE, MAX_GUESSES, ROUNDS_EACH, codeShape } from './options.ts';
import type { Mode } from './options.ts';
import type { Board, Color, GameState, Guess, RoundResult, RoundSummary, Seat } from './types.ts';

const EMPTY_BOARD: Board = { guesses: [], broken: false };
const CLASSIC_ROUNDS = 2 * ROUNDS_EACH;

const ROUND: RoundAccess<GameState, RoundSummary> = {
  get: state => state.summary,
  set: (state, summary) => ({ ...state, summary }),
  noun: 'round'
};

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    phase: 'setting',
    code: null,
    maker: null,
    round: 1,
    board: EMPTY_BOARD,
    boards: {},
    finishOrder: [],
    points: {},
    rounds: [],
    summary: null,
    contributions: {},
    lastMove: null
  };
}

export function modeIn(state: GameState): Mode {
  return modeOf(state, CODEBREAKER_MODE);
}

export function isFinished(board: Board): boolean {
  return board.broken || board.guesses.length >= MAX_GUESSES;
}

// Whether the code may be shown to everyone
export function isRevealed(state: GameState): boolean {
  return state.isGameOver || (modeIn(state) === 'classic' && state.phase === 'summary');
}

const makerOf = (state: GameState, round: number): Seat => state.activePlayers[(round - 1) % 2];
const breakerOf = (state: GameState, round: number): Seat => state.activePlayers[round % 2];

// Classic round `round` waits for its maker's code
function startRound(state: GameState, round: number): GameState {
  const maker = makerOf(state, round);
  return {
    ...state, phase: 'setting', code: null, maker, round, board: EMPTY_BOARD, summary: null, lastMove: null,
    currentPlayer: maker, gameStatus: `${state.playerNames[maker]} is setting the code`
  };
}

export function resetLobby(state: GameState): GameState {
  const empty: GameState = {
    ...state, phase: 'setting', code: null, maker: null, round: 1, board: EMPTY_BOARD, boards: {}, finishOrder: [],
    points: {}, rounds: [], summary: null, contributions: {}, lastMove: null
  };
  if (modeIn(state) === 'classic' && state.activePlayers.length === 2) return startRound(empty, 1);
  return empty;
}

function pegsOf(state: GameState, move: Record<string, unknown>): Result<Color[]> {
  const { pegs, colors } = codeShape(houseRule(state, CODE_RULE));
  const given = move.pegs;
  const valid = Array.isArray(given) && given.length === pegs && given.every(peg => colors.includes(peg as Color));
  return valid ? { state: given as Color[] } : { error: `Pick ${pegs} colors` };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const m = asRecord(move);
  if (!m) return { error: 'Invalid move' };
  if (modeIn(state) !== 'classic') return { error: 'Invalid move' }; // Solo, Together and Race arrive with their own paths
  if (state.isGameOver || state.phase === 'summary') return { error: 'Invalid move' };
  if (m.type === 'setCode') {
    if (state.phase !== 'setting' || seat !== state.maker) return { error: 'Invalid move' };
    const pegs = pegsOf(state, m);
    if ('error' in pegs) return pegs;
    const breaker = breakerOf(state, state.round);
    return {
      state: {
        ...state, code: pegs.state, phase: 'breaking', currentPlayer: breaker, lastMove: { type: 'setCode', playerNumber: seat },
        gameStatus: `${state.playerNames[seat]} set the code. ${state.playerNames[breaker]} breaks it`
      }
    };
  }
  if (m.type === 'guess') {
    if (state.phase === 'setting' || !state.code) return { error: 'Wait for the code' };
    const pegs = pegsOf(state, m);
    if ('error' in pegs) return pegs;
    return { state: classicGuess(state, seat, pegs.state, state.code) };
  }
  return { error: 'Invalid move' };
}

function classicGuess(state: GameState, seat: Seat, pegs: Color[], code: Color[]): GameState {
  const clue = feedback(code, pegs);
  const broken = clue.exact === code.length;
  const guess: Guess = { pegs, feedback: clue, by: seat };
  const board: Board = { guesses: [...state.board.guesses, guess], broken };
  const outOfGuesses = !broken && board.guesses.length >= MAX_GUESSES;
  const moved: GameState = {
    ...state, board, lastMove: { type: 'guess', playerNumber: seat, feedback: clue, broken, outOfGuesses },
    gameStatus: `${state.playerNames[seat]} made guess ${board.guesses.length}`
  };
  return isFinished(board) ? endRound(moved, seat, code) : moved;
}

function endRound(state: GameState, breaker: Seat, code: Color[]): GameState {
  const guesses = state.board.guesses.length;
  const broken = state.board.broken;
  const earned = guesses + (broken ? 0 : 1);
  const result: RoundResult = { round: state.round, maker: state.maker as Seat, breaker, code, guesses, broken, points: earned };
  const name = state.playerNames[breaker];
  return {
    ...state,
    phase: 'summary',
    points: { ...state.points, [breaker]: (state.points[breaker] ?? 0) + earned },
    rounds: [...state.rounds, result],
    summary: { ...result, acknowledged: [] },
    gameStatus: broken ? `${name} broke the code in ${guesses} ${guesses === 1 ? 'guess' : 'guesses'}` : `${name} ran out of guesses`
  };
}

export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  const a = asRecord(action);
  if (a?.type !== 'continue' || modeIn(state) !== 'classic' || state.phase !== 'summary' || state.isGameOver) {
    return { error: 'Nothing to continue' };
  }
  return acknowledge(state, seat, ROUND, next => next.round >= CLASSIC_ROUNDS ? endGame(next) : startRound(next, next.round + 1));
}

const total = (state: GameState, seat: Seat): number => state.points[seat] ?? 0;

function endGame(state: GameState): GameState {
  const best = Math.min(...state.activePlayers.map(seat => total(state, seat)));
  const winners = state.activePlayers.filter(seat => total(state, seat) === best);
  const names = winners.map(seat => state.playerNames[seat]).join(' and ');
  return {
    ...state, isGameOver: true, currentPlayer: null, winners,
    gameStatus: `${names} ${winners.length > 1 ? 'tied' : 'won'} with ${pointsText(best)}`
  };
}

// Called with one player left (the game continues alone), but Classic needs two: the one left behind wins
export function onPlayerLeft(state: GameState): GameState {
  if (modeIn(state) !== 'classic' || state.activePlayers.length !== 1) return state;
  const winner = state.activePlayers[0];
  return {
    ...state, isGameOver: true, currentPlayer: null, winners: [winner], undoVote: null,
    gameStatus: `${state.playerNames[winner]} wins! Everyone else left.`
  };
}

export function waitingOn(state: GameState): Seat[] {
  return state.phase === 'summary' ? awaiting(state, ROUND) : [];
}

// Place 1 is exactly state.winners in every mode; the rest rank by total, lowest first
export function finalStandings(state: GameState): Standing[] {
  return rankStandings(state, (a, b) => total(state, a) - total(state, b), seat => pointsText(total(state, seat)));
}
