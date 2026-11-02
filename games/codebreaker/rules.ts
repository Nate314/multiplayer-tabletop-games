// Code breaker rules. Classic: two players alternate as maker and breaker for four rounds.
// Solo, Together and Race: the computer draws the code and nobody sees it until the game ends.
import { rollDie } from '../../shared/dice.ts';
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { addContribution, modeOf, playsAtOnce, raceProgress, visibleBoards } from '../../shared/puzzleModes.ts';
import { acknowledge, awaiting, everyoneReady } from '../../shared/rounds.ts';
import type { RoundAccess } from '../../shared/rounds.ts';
import { baseGameState } from '../../shared/seating.ts';
import { pointsText, rankStandings } from '../../shared/standings.ts';
import { plural } from '../../shared/text.ts';
import type { Random, Result, Standing } from '../../shared/types.ts';
import { feedback } from './feedback.ts';
import { CODEBREAKER_MODE, CODE_RULE, MAX_GUESSES, ROUNDS_EACH, codeShape, isFinished } from './options.ts';
import type { Mode } from './options.ts';
import type { Board, Color, GameState, Guess, PublicGameState, RoundResult, RoundSummary, Seat } from './types.ts';

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

// Whether the code may be shown to everyone
export function isRevealed(state: GameState): boolean {
  return state.isGameOver || (modeIn(state) === 'classic' && state.phase === 'summary');
}

const makerOf = (state: GameState, round: number): Seat => state.activePlayers[(round - 1) % 2];
const breakerOf = (state: GameState, round: number): Seat => state.activePlayers[round % 2];
const over = (winners: Seat[]) => ({ isGameOver: true, currentPlayer: null, winners });

// Classic round `round` waits for its maker's code
function startRound(state: GameState, round: number): GameState {
  const maker = makerOf(state, round);
  return {
    ...state, phase: 'setting', code: null, maker, round, board: EMPTY_BOARD, summary: null, lastMove: null,
    currentPlayer: maker, gameStatus: `${state.playerNames[maker]} is setting the code`
  };
}

// Runs after every seat and house rule change, so a drawn code always matches the current Code rule
export function resetLobby(state: GameState, random: Random): GameState {
  const empty: GameState = {
    ...state, phase: 'setting', code: null, maker: null, round: 1, board: EMPTY_BOARD, boards: {}, finishOrder: [],
    points: {}, rounds: [], summary: null, contributions: {}, lastMove: null
  };
  const mode = modeIn(state);
  if (mode === 'classic') return state.activePlayers.length === 2 ? startRound(empty, 1) : empty;
  const { pegs, colors } = codeShape(houseRule(state, CODE_RULE));
  const code = Array.from({ length: pegs }, () => colors[rollDie(random, colors.length) - 1]);
  const boards = mode === 'race' ? Object.fromEntries(state.activePlayers.map(seat => [seat, EMPTY_BOARD])) : {};
  return {
    ...empty, phase: 'breaking', code, boards,
    currentPlayer: playsAtOnce(mode) ? null : state.activePlayers[0] ?? null, gameStatus: 'Break the code'
  };
}

function pegsOf(state: GameState, move: Record<string, unknown>): Result<Color[]> {
  const { pegs, colors } = codeShape(houseRule(state, CODE_RULE));
  const given = move.pegs;
  const valid = Array.isArray(given) && given.length === pegs && given.every(peg => colors.includes(peg as Color));
  return valid ? { state: given as Color[] } : { error: `Pick ${pegs} colors` };
}

// `board` with a guess by `seat` added, scored against the code
function addGuess(state: GameState, board: Board, seat: Seat, pegs: Color[]): Board {
  const code = state.code as Color[];
  const clue = feedback(code, pegs);
  return { guesses: [...board.guesses, { pegs, feedback: clue, by: seat }], broken: clue.exact === code.length };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const m = asRecord(move);
  if (!m) return { error: 'Invalid move' };
  const mode = modeIn(state);
  if (mode === 'solo') return m.type === 'guess' && !state.isGameOver ? sharedGuess(state, seat, m) : { error: 'Invalid move' };
  if (mode !== 'classic') return { error: 'Invalid move' }; // Together and Race guess with actions
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

// A guess on the one board (Solo, Together): breaking it wins for everyone at the table, ten misses lose
function sharedGuess(state: GameState, seat: Seat, move: Record<string, unknown>): Result<GameState> {
  const pegs = pegsOf(state, move);
  if ('error' in pegs) return pegs;
  const board = addGuess(state, state.board, seat, pegs.state);
  const clue = board.guesses[board.guesses.length - 1].feedback;
  const outOfGuesses = !board.broken && isFinished(board);
  const moved: GameState = {
    ...state, board, lastMove: { type: 'guess', playerNumber: seat, feedback: clue, broken: board.broken, outOfGuesses },
    contributions: modeIn(state) === 'together' ? addContribution(state.contributions, seat) : state.contributions,
    gameStatus: `${state.playerNames[seat]} made guess ${board.guesses.length}`
  };
  if (board.broken) {
    return { state: { ...moved, ...over(state.activePlayers), gameStatus: `Broken in ${plural(board.guesses.length, 'guess', 'guesses')}!` } };
  }
  return { state: outOfGuesses ? { ...moved, ...over([]), gameStatus: 'The code was not broken' } : moved };
}

// A guess on the guesser's own Race board; only the guess count and whether it broke the code are public
function raceGuess(state: GameState, seat: Seat, move: Record<string, unknown>): Result<GameState> {
  const own = state.boards[seat];
  if (!own) return { error: 'Invalid move' };
  if (isFinished(own)) return { error: 'Your board is finished' };
  const pegs = pegsOf(state, move);
  if ('error' in pegs) return pegs;
  const board = addGuess(state, own, seat, pegs.state);
  const name = state.playerNames[seat];
  const count = board.guesses.length;
  return {
    state: raceEndCheck({
      ...state,
      boards: { ...state.boards, [seat]: board },
      finishOrder: board.broken ? [...state.finishOrder, seat] : state.finishOrder,
      lastMove: { type: 'raceGuess', playerNumber: seat, guessNumber: count, broken: board.broken },
      gameStatus: board.broken ? `${name} broke the code in ${plural(count, 'guess', 'guesses')}` : `${name} made guess ${count}`
    })
  };
}

const raceSeats = (state: GameState): Seat[] => state.activePlayers.filter(seat => state.boards[seat]);
const guessCount = (state: GameState, seat: Seat): number => state.boards[seat]?.guesses.length ?? 0;
const unfinished = (state: GameState): Seat[] => raceSeats(state).filter(seat => !isFinished(state.boards[seat] as Board));

// The fewest guesses on a broken board, or Infinity while nobody has broken it
const bestRace = (state: GameState): number => Math.min(...state.finishOrder.map(seat => guessCount(state, seat)));

// Over once nobody still guessing can match or beat the best; ties go to who finished first
function raceEndCheck(state: GameState): GameState {
  const best = bestRace(state);
  if (unfinished(state).some(seat => guessCount(state, seat) < best)) return state;
  const winner = state.finishOrder.find(seat => guessCount(state, seat) === best);
  if (winner === undefined) return { ...state, ...over([]), gameStatus: 'Nobody broke the code' };
  return { ...state, ...over([winner]), gameStatus: `${state.playerNames[winner]} wins, breaking the code in ${plural(best, 'guess', 'guesses')}` };
}

export function recordsAction(state: GameState, _seat: Seat, action: unknown): boolean {
  return playsAtOnce(modeIn(state)) && !state.isGameOver && asRecord(action)?.type === 'guess';
}

export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  const a = asRecord(action);
  const mode = modeIn(state);
  if (a?.type === 'guess' && playsAtOnce(mode)) {
    if (state.isGameOver || !state.activePlayers.includes(seat)) return { error: 'Invalid move' };
    const guessed = mode === 'race' ? raceGuess(state, seat, a) : sharedGuess(state, seat, a);
    // A guess starts play, so the server holds it to the house rule agreement like a move
    return 'error' in guessed ? guessed : { state: { ...guessed.state, started: true } };
  }
  if (a?.type !== 'continue' || mode !== 'classic' || state.phase !== 'summary' || state.isGameOver) {
    return { error: 'Nothing to continue' };
  }
  return acknowledge(state, seat, ROUND, nextRound);
}

const nextRound = (state: GameState): GameState => state.round >= CLASSIC_ROUNDS ? endGame(state) : startRound(state, state.round + 1);

// The next round may have been waiting only for the player who disconnected
export function onPlayerDisconnected(state: GameState): GameState {
  return everyoneReady(state, ROUND) ? nextRound(state) : state;
}

const total = (state: GameState, seat: Seat): number => state.points[seat] ?? 0;

function endGame(state: GameState): GameState {
  const best = Math.min(...state.activePlayers.map(seat => total(state, seat)));
  const winners = state.activePlayers.filter(seat => total(state, seat) === best);
  const names = winners.map(seat => state.playerNames[seat]).join(' and ');
  return { ...state, ...over(winners), gameStatus: `${names} ${winners.length > 1 ? 'tied' : 'won'} with ${pointsText(best)}` };
}

// Together plays on with whoever is left; Race drops the leaver's board and checks whether that ends the race.
// Classic needs two, so with one left (the game continues alone) the one left behind wins.
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const mode = modeIn(state);
  if (mode === 'race') {
    const boards = { ...state.boards };
    delete boards[seat];
    return raceEndCheck({ ...state, boards, finishOrder: state.finishOrder.filter(finisher => finisher !== seat) });
  }
  if (mode !== 'classic' || state.activePlayers.length !== 1) return state;
  const winner = state.activePlayers[0];
  return { ...state, ...over([winner]), undoVote: null, gameStatus: `${state.playerNames[winner]} wins! Everyone else left.` };
}

// Together and Race: each player undoes only their own guesses, with no vote
export function allowsUndoVote(state: GameState): boolean {
  return !playsAtOnce(modeIn(state));
}

export function undoOwn(state: GameState, seat: Seat): Result<GameState> {
  const mode = modeIn(state);
  if (!playsAtOnce(mode)) return { error: 'Use Undo' };
  if (state.isGameOver) return { error: 'The game is over' };
  const lastMove = { type: 'undoOwn' as const, playerNumber: seat };
  const gameStatus = `${state.playerNames[seat]} took back a guess`;
  if (mode === 'race') {
    const own = state.boards[seat];
    if (!own?.guesses.length) return { error: 'Nothing of yours to undo' };
    if (isFinished(own)) return { error: 'Your board is finished' };
    return { state: { ...state, boards: { ...state.boards, [seat]: { ...own, guesses: own.guesses.slice(0, -1) } }, lastMove, gameStatus } };
  }
  const index = state.board.guesses.map(guess => guess.by).lastIndexOf(seat);
  if (index < 0) return { error: 'Nothing of yours to undo' };
  const guesses = state.board.guesses.filter((_, i) => i !== index);
  return {
    state: { ...state, board: { ...state.board, guesses }, contributions: addContribution(state.contributions, seat, -1), lastMove, gameStatus }
  };
}

// Race waits on every unfinished board; Together on nobody in particular
export function waitingOn(state: GameState): Seat[] {
  if (modeIn(state) === 'race') return state.isGameOver ? [] : unfinished(state);
  return state.phase === 'summary' ? awaiting(state, ROUND) : [];
}

// Race progress: 100 once broken, else the best guess's share of exact pegs
export function progressOf(board: Board, pegs: number): number {
  if (board.broken) return 100;
  return Math.round(100 * Math.max(0, ...board.guesses.map(guess => guess.feedback.exact)) / pegs);
}

// Race adds the progress it ranks unbroken boards by
const brokenText = (board: Board, progress?: number): string =>
  board.broken ? `Broken in ${plural(board.guesses.length, 'guess', 'guesses')}` : progress === undefined ? 'Not broken' : `Not broken, ${progress}%`;

// Place 1 is exactly state.winners in every mode
export function finalStandings(state: GameState): Standing[] {
  const mode = modeIn(state);
  if (mode === 'solo') return rankStandings(state, () => 0, () => brokenText(state.board));
  if (mode === 'together') return rankStandings(state, () => 0, seat => plural(state.contributions[seat] ?? 0, 'guess', 'guesses'));
  if (mode === 'race') {
    const { pegs } = codeShape(houseRule(state, CODE_RULE));
    const boardOf = (seat: Seat): Board => state.boards[seat] ?? EMPTY_BOARD;
    return rankStandings(state, (a, b) => compareRace(state, a, b), seat => brokenText(boardOf(seat), progressOf(boardOf(seat), pegs)));
  }
  // Classic: the rest rank by total, lowest first
  return rankStandings(state, (a, b) => total(state, a) - total(state, b), seat => pointsText(total(state, seat)));
}

// Broken boards first, by guesses then who finished first; the rest by progress, highest first
function compareRace(state: GameState, a: Seat, b: Seat): number {
  const order = (seat: Seat): number => state.finishOrder.indexOf(seat);
  const brokeA = order(a) >= 0;
  if (brokeA !== order(b) >= 0) return brokeA ? -1 : 1;
  if (brokeA) return guessCount(state, a) - guessCount(state, b) || order(a) - order(b);
  const { pegs } = codeShape(houseRule(state, CODE_RULE));
  const progress = (seat: Seat): number => progressOf(state.boards[seat] ?? EMPTY_BOARD, pegs);
  return progress(b) - progress(a);
}

// The code goes only to its maker until the round or game ends; Race boards only to their owner until the game ends
export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  return view(state, undoAvailable, viewer, visibleBoards(state.boards, viewer, state.isGameOver));
}

// A spectator sees every Race board, never the code before the reveal. A table screen faces the players, so it sees what History sees
export function spectatorState(state: GameState, undoAvailable: boolean, tableScreen: boolean): Omit<PublicGameState, 'moveCount'> {
  return tableScreen ? toPublicState(state, undoAvailable, null) : view(state, undoAvailable, null, state.boards);
}

function view(state: GameState, undoAvailable: boolean, viewer: Seat | null, boards: GameState['boards']): Omit<PublicGameState, 'moveCount'> {
  const { pegs } = codeShape(houseRule(state, CODE_RULE));
  const seesCode = isRevealed(state) || (viewer !== null && viewer === state.maker);
  return {
    ...state,
    code: seesCode ? state.code : null,
    boards,
    progress: raceProgress(state.boards, board => progressOf(board, pegs)),
    guessesUsed: Object.fromEntries(Object.entries(state.boards).map(([seat, board]) => [seat, (board as Board).guesses.length])),
    undoAvailable
  };
}
