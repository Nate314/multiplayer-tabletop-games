// Connect Four rules shared by the browser (column hints) and the server (validation).
import { applyEndingAction, endGame, lapseDrawOffer } from '../../shared/drawOffer.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import type { Board, GameState, Position, PublicGameState, Result, Seat } from './types.ts';

export const COLUMNS = 7;
export const ROWS = 6;
const LINE = 4;

export const SEAT_COLORS: Record<Seat, string> = { 1: 'Red', 2: 'Yellow' };

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Seat | null>(COLUMNS).fill(null));
}

export function isColumn(column: unknown): column is number {
  return Number.isInteger(column) && (column as number) >= 0 && (column as number) < COLUMNS;
}

export function isColumnFull(board: Board, column: number): boolean {
  return board[0][column] !== null;
}

// The row a disc dropped into `column` comes to rest in, or -1 when the column is full
export function landingRow(board: Board, column: number): number {
  for (let row = ROWS - 1; row >= 0; row--) if (board[row][column] === null) return row;
  return -1;
}

const DIRECTIONS: Position[] = [{ row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: -1 }];

// The four cells in a row through `from` that all hold `seat`, if there are any
function lineThrough(board: Board, { row, col }: Position, seat: Seat): Position[] | null {
  for (const dir of DIRECTIONS) {
    // Walk back to where the run of this seat's discs starts, then take four from there
    let start = { row, col };
    while (board[start.row - dir.row]?.[start.col - dir.col] === seat) start = { row: start.row - dir.row, col: start.col - dir.col };
    const cells = Array.from({ length: LINE }, (_, i) => ({ row: start.row + dir.row * i, col: start.col + dir.col * i }));
    if (cells.every(cell => board[cell.row]?.[cell.col] === seat)) return cells;
  }
  return null;
}

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), board: createBoard(), lastMove: null, winningLine: null, drawOffer: null };
}

// The board never changes before the first move, whoever joins or leaves
export function resetLobby(state: GameState): GameState {
  return state;
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

// One line about a move, used for the status and the history dialog
export function moveSummary(name: string, column: number): string {
  return `${name} dropped a disc in column ${column + 1}`;
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const input = asRecord(move);
  if (input?.type !== 'drop') return { error: 'Unknown move type' };
  if (!isColumn(input.column)) return { error: 'Invalid column' };
  const column = input.column;
  const row = landingRow(state.board, column);
  if (row < 0) return { error: 'That column is full' };

  const board = state.board.map((cells, r) => r === row ? cells.map((cell, c) => c === column ? seat : cell) : cells);
  const name = state.playerNames[seat];
  const next: GameState = lapseDrawOffer({
    ...state,
    board,
    lastMove: { playerNumber: seat, row, column },
    gameStatus: moveSummary(name, column),
    currentPlayer: nextActivePlayer(state, seat)
  }, seat);

  const winningLine = lineThrough(board, { row, col: column }, seat);
  if (winningLine) return { state: { ...endGame(next, [seat], `${name} wins with four in a row!`), winningLine } };
  if (board[0].every(cell => cell !== null)) return { state: endGame(next, [], 'The board is full. Draw.') };
  return { state: next };
}

// Resigning and draws by agreement, the shared ending actions
export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  return applyEndingAction(state, seat, action);
}
