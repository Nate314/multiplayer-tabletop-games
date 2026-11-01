// Sudoku rules: Solo plays by moves; Together and Race play by actions, any seat at any time
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import {
  addContribution, MODE_RULE, modeOf, playsAtOnce, raceProgress, visibleBoards, type Contributions, type PuzzleMode
} from '../../shared/puzzleModes.ts';
import { baseGameState } from '../../shared/seating.ts';
import { rankStandings } from '../../shared/standings.ts';
import type { Random, Standing } from '../../shared/types.ts';
import { generatePuzzle } from './generator.ts';
import { CELLS } from './grid.ts';
import { DIFFICULTY } from './options.ts';
import type { Board, GameState, LastMove, OwnMove, PublicGameState, PublicLastMove, Result, Seat } from './types.ts';

const STATUS: Record<PuzzleMode, string> = {
  solo: 'Solve the puzzle',
  together: 'Everyone plays at once on one board',
  race: 'Race: everyone has the same puzzle; first to finish wins'
};

const GAME_OVER = 'The game is over';
const WRONG_KIND = 'Wrong kind of entry for this mode';
const INVALID = 'Invalid move';

const emptyBoard = (): Board => ({ entries: Array(CELLS).fill(0), by: Array(CELLS).fill(null) });
const modeOfState = (state: GameState): PuzzleMode => modeOf(state, MODE_RULE);
const withoutSeat = <V>(record: Partial<Record<Seat, V>>, seat: Seat): Partial<Record<Seat, V>> => {
  const rest = { ...record };
  delete rest[seat];
  return rest;
};

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId),
    difficulty: DIFFICULTY.standard,
    givens: [],
    solution: [],
    board: emptyBoard(),
    raceBoards: {},
    notes: {},
    ownMoves: {},
    showMistakes: false,
    raceWrong: {},
    lastMove: null
  };
}

// A new puzzle only when there is none or the difficulty changed, so a join does not reshuffle it.
// Together and Race have no turns, so nobody is currentPlayer; Solo keeps the platform's seat 1
export function resetLobby(state: GameState, random: Random): GameState {
  const difficulty = houseRule(state, DIFFICULTY);
  const puzzle = state.givens.length === 0 || state.difficulty !== difficulty
    ? generatePuzzle(difficulty, random)
    : { givens: state.givens, solution: state.solution };
  const mode = modeOfState(state);
  return {
    ...state,
    difficulty,
    ...puzzle,
    board: emptyBoard(),
    raceBoards: mode === 'race' ? Object.fromEntries(state.activePlayers.map(seat => [seat, emptyBoard()])) : {},
    notes: {},
    ownMoves: {},
    raceWrong: {},
    lastMove: null,
    currentPlayer: playsAtOnce(mode) ? null : state.currentPlayer,
    gameStatus: STATUS[mode]
  };
}

const isCell = (cell: unknown): cell is number => Number.isInteger(cell) && (cell as number) >= 0 && (cell as number) < CELLS;
const isDigit = (digit: unknown): digit is number => Number.isInteger(digit) && (digit as number) >= 1 && (digit as number) <= 9;

const boardOf = (state: GameState, seat: Seat): Board | undefined => (modeOfState(state) === 'race' ? state.raceBoards[seat] : state.board);
const putBoard = (state: GameState, seat: Seat, board: Board): GameState =>
  modeOfState(state) === 'race' ? { ...state, raceBoards: { ...state.raceBoards, [seat]: board } } : { ...state, board };

const isFull = (state: GameState, board: Board): boolean => state.givens.every((given, cell) => given || board.entries[cell]);
const isSolved = (state: GameState, board: Board): boolean => state.solution.every((digit, cell) => (state.givens[cell] || board.entries[cell]) === digit);

// Ends the game when the changed board is solved; a full wrong Race board is flagged for its owner only
function settle(state: GameState, seat: Seat): GameState {
  const board = boardOf(state, seat);
  const raceWrong = withoutSeat(state.raceWrong, seat);
  if (!board) return state;
  const mode = modeOfState(state);
  if (mode === 'race') {
    if (!isFull(state, board)) return { ...state, raceWrong };
    if (!isSolved(state, board)) return { ...state, raceWrong: { ...raceWrong, [seat]: true } };
    const lastMove = state.lastMove?.type === 'enter' ? { ...state.lastMove, finished: true as const } : state.lastMove;
    return { ...state, raceWrong, lastMove, isGameOver: true, currentPlayer: null, winners: [seat], gameStatus: `${state.playerNames[seat]} finished first!` };
  }
  if (!isSolved(state, board)) return state;
  return { ...state, isGameOver: true, currentPlayer: null, winners: [...state.activePlayers], gameStatus: mode === 'solo' ? 'Solved!' : 'Solved together!' };
}

// Enters `digit` (0 erases) in `cell` for `seat`, through a Solo move or a Together or Race action
export function place(state: GameState, seat: Seat, cell: unknown, digit: number): Result<GameState> {
  if (!isCell(cell)) return { error: 'Pick a square' };
  if (state.givens[cell]) return { error: 'That square is a given' };
  const board = boardOf(state, seat);
  if (!board) return { error: GAME_OVER };
  const mode = modeOfState(state);
  const before = board.entries[cell];
  const beforeBy = board.by[cell];
  if (digit === 0 && before === 0) return { error: 'That square is empty' };
  // The digit the square already holds changes nothing: silent in Together and Race, refused as a Solo move
  if (digit && digit === before) return playsAtOnce(mode) ? { state } : { error: `That square already holds ${digit}` };
  if (mode === 'together' && before === state.solution[cell]) {
    return { error: digit === 0 ? 'A correct entry is locked' : 'That square is already correct' };
  }

  const entries = [...board.entries];
  const by = [...board.by];
  entries[cell] = digit;
  by[cell] = digit ? seat : null;
  let next = putBoard(state, seat, { entries, by });

  if (digit) {
    const own = state.notes[seat];
    if (own?.[cell]) next = { ...next, notes: { ...next.notes, [seat]: own.map((mask, at) => (at === cell ? 0 : mask)) } };
  }
  if (playsAtOnce(mode)) {
    const move: OwnMove = { cell, before, beforeBy, after: digit };
    next = { ...next, ownMoves: { ...next.ownMoves, [seat]: [...(next.ownMoves[seat] ?? []), move] } };
  }
  const lastMove: LastMove = digit ? { type: 'enter', playerNumber: seat, cell, digit } : { type: 'erase', playerNumber: seat, cell };
  return { state: settle({ ...next, lastMove, started: true }, seat) };
}

// An entry or erase from untrusted input; `atOnce` is whether it came as an action
function entry(state: GameState, seat: Seat, input: Record<string, unknown>, atOnce: boolean): Result<GameState> {
  if (playsAtOnce(modeOfState(state)) !== atOnce) return { error: WRONG_KIND };
  if (input.type === 'erase') return place(state, seat, input.cell, 0);
  if (!isCell(input.cell)) return { error: 'Pick a square' };
  if (!isDigit(input.digit)) return { error: 'Pick a digit from 1 to 9' };
  return place(state, seat, input.cell, input.digit);
}

const isEntry = (input: Record<string, unknown> | null): boolean => input?.type === 'enter' || input?.type === 'erase';
// An entry of the digit the square already holds, which place leaves as it is
const repeatsEntry = (state: GameState, seat: Seat, input: Record<string, unknown> | null): boolean =>
  input?.type === 'enter' && isCell(input.cell) && isDigit(input.digit) && boardOf(state, seat)?.entries[input.cell] === input.digit;

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  if (state.isGameOver) return { error: GAME_OVER };
  const input = asRecord(move);
  return input && isEntry(input) ? entry(state, seat, input, false) : { error: INVALID };
}

// Toggles the seat's own pencil mark for `digit` in `cell`
function toggleNote(state: GameState, seat: Seat, input: Record<string, unknown>): Result<GameState> {
  const { cell, digit } = input;
  if (!isCell(cell)) return { error: 'Pick a square' };
  if (!isDigit(digit)) return { error: 'Pick a digit from 1 to 9' };
  if (state.givens[cell]) return { error: 'That square is a given' };
  const own = [...(state.notes[seat] ?? Array(CELLS).fill(0))];
  own[cell] ^= 1 << digit;
  return { state: { ...state, notes: { ...state.notes, [seat]: own }, started: true } };
}

export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  if (state.isGameOver) return { error: GAME_OVER };
  const input = asRecord(action);
  if (input && isEntry(input)) return entry(state, seat, input, true);
  if (input?.type === 'note') return toggleNote(state, seat, input);
  if (input?.type === 'showMistakes' && typeof input.on === 'boolean') {
    if (modeOfState(state) !== 'solo') return { error: 'Mistakes are shown only in Solo' };
    return { state: { ...state, showMistakes: input.on, started: true } };
  }
  return { error: INVALID };
}

export function recordsAction(state: GameState, seat: Seat, action: unknown): boolean {
  const input = asRecord(action);
  return isEntry(input) && playsAtOnce(modeOfState(state)) && !repeatsEntry(state, seat, input);
}

export function allowsUndoVote(state: GameState): boolean {
  return !playsAtOnce(modeOfState(state));
}

// Takes back the seat's last move whose cell still holds it; moves a friend has since changed are dropped as stale
export function undoOwn(state: GameState, seat: Seat): Result<GameState> {
  if (state.isGameOver) return { error: GAME_OVER };
  if (modeOfState(state) === 'solo') return { error: 'Solo uses Undo' };
  const board = boardOf(state, seat);
  const stack = [...(state.ownMoves[seat] ?? [])];
  for (let move = stack.pop(); board && move; move = stack.pop()) {
    const { cell, after } = move;
    if (board.entries[cell] !== after || board.by[cell] !== (after ? seat : null)) continue;
    const entries = [...board.entries];
    const by = [...board.by];
    entries[cell] = move.before;
    by[cell] = move.beforeBy;
    const next = putBoard({ ...state, ownMoves: { ...state.ownMoves, [seat]: stack } }, seat, { entries, by });
    return { state: settle({ ...next, lastMove: { type: 'undoOwn', playerNumber: seat, cell } }, seat) };
  }
  return { error: 'Nothing of yours to undo' };
}

const openCellsOf = (state: GameState): number[] => state.givens.flatMap((given, cell) => (given ? [] : [cell]));
const wrongCells = (state: GameState, board: Board): number[] =>
  openCellsOf(state).filter(cell => board.entries[cell] && board.entries[cell] !== state.solution[cell]);

// The share of non-given cells a Race board has filled, wrong or not
function percentFilled(state: GameState, board: Board): number {
  const open = openCellsOf(state);
  return open.length ? (100 * open.filter(cell => board.entries[cell]).length) / open.length : 100;
}

// Another seat's Race move, while the race is on, shows only who moved, never the cell or digit
function shownLastMove(state: GameState, viewer: Seat | null, seesEverything: boolean): PublicLastMove | null {
  const { lastMove } = state;
  if (!lastMove || seesEverything || state.isGameOver || modeOfState(state) !== 'race' || lastMove.playerNumber === viewer) return lastMove;
  return { type: lastMove.type, playerNumber: lastMove.playerNumber };
}

// `seesEverything` is an ordinary spectator: every Race board and the full last move, still no solution or notes
function view(state: GameState, undoAvailable: boolean, viewer: Seat | null, seesEverything: boolean): Omit<PublicGameState, 'moveCount'> {
  const { solution, notes, ownMoves: _ownMoves, raceWrong, showMistakes, lastMove: _lastMove, ...rest } = state;
  const mode = modeOfState(state);
  const shown: Omit<PublicGameState, 'moveCount'> = {
    ...rest,
    undoAvailable: playsAtOnce(mode) ? false : undoAvailable,
    raceBoards: seesEverything ? state.raceBoards : visibleBoards(state.raceBoards, viewer, state.isGameOver),
    progress: mode === 'race' ? raceProgress(state.raceBoards, board => percentFilled(state, board)) : {},
    myNotes: viewer === null ? null : notes[viewer] ?? [],
    boardWrong: viewer !== null && !!raceWrong[viewer],
    ownUndo: viewer !== null && 'state' in undoOwn(state, viewer),
    lastMove: shownLastMove(state, viewer, seesEverything)
  };
  if (state.isGameOver) shown.solution = solution;
  if (mode === 'solo') shown.showMistakes = showMistakes;
  if (mode === 'together' || (mode === 'solo' && showMistakes)) shown.wrong = wrongCells(state, state.board);
  return shown;
}

// A seat sees its own Race board, notes and moves; `null` is the History and the table screen
export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null): Omit<PublicGameState, 'moveCount'> {
  return view(state, undoAvailable, viewer, false);
}

// A table screen is in view of the racers, so it gets the History view
export function spectatorState(state: GameState, undoAvailable: boolean, tableScreen: boolean): Omit<PublicGameState, 'moveCount'> {
  return view(state, undoAvailable, null, !tableScreen);
}

// Together keeps the leaver's entries; their marks, undo stack and Race board go
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  return {
    ...state,
    notes: withoutSeat(state.notes, seat),
    ownMoves: withoutSeat(state.ownMoves, seat),
    raceWrong: withoutSeat(state.raceWrong, seat),
    raceBoards: withoutSeat(state.raceBoards, seat)
  };
}

// The share of non-given cells a Race board has right, as a whole percent
function percentCorrect(state: GameState, board: Board | undefined): number {
  const open = openCellsOf(state);
  const right = open.filter(cell => board?.entries[cell] === state.solution[cell]).length;
  return open.length ? Math.round((100 * right) / open.length) : 100;
}

export function finalStandings(state: GameState): Standing[] {
  const mode = modeOfState(state);
  if (mode === 'race') {
    const percent = (seat: Seat) => percentCorrect(state, state.raceBoards[seat]);
    return rankStandings(state, (a, b) => percent(b) - percent(a), seat => (state.winners.includes(seat) ? 'Solved' : `${percent(seat)}% correct`));
  }
  if (mode === 'solo') return rankStandings(state, () => 0, () => 'Solved');
  const counts = state.board.by.reduce<Contributions>((sum, seat) => (seat === null ? sum : addContribution(sum, seat)), {});
  return rankStandings(state, () => 0, seat => {
    const n = counts[seat] ?? 0;
    return `${n} ${n === 1 ? 'square' : 'squares'}`;
  });
}
