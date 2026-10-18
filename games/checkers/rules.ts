// Checkers rules shared by the browser (move hints) and the server (validation).
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import type { Board, GameState, LastMove, Piece, Position, PublicGameState, Result, Seat } from './types.ts';

export const BOARD_SIZE = 8;

// 40 moves per side with no capture and no man moving
export const DRAW_PLIES = 80;

const ROWS_PER_SIDE = 3;

// The row direction each seat's men move in: seat 1 moves up the board, seat 2 down
const FORWARD: Record<Seat, number> = { 1: -1, 2: 1 };

export const SEAT_COLORS: Record<Seat, string> = { 1: 'Red', 2: 'White' };

export function isDarkSquare({ row, col }: Position): boolean {
  return (row + col) % 2 === 1;
}

function isOnBoard({ row, col }: Position): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function isSamePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

function crownRow(seat: Seat): number {
  return FORWARD[seat] < 0 ? 0 : BOARD_SIZE - 1;
}

export function pieceAt(board: Board, { row, col }: Position): Piece | null {
  return board[row]?.[col] ?? null;
}

// Seat 2 fills the top three rows and seat 1 the bottom three, on the dark squares only
export function createBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, col) => {
      if (!isDarkSquare({ row, col })) return null;
      if (row < ROWS_PER_SIDE) return { seat: 2, king: false };
      if (row >= BOARD_SIZE - ROWS_PER_SIDE) return { seat: 1, king: false };
      return null;
    })
  );
}

// Men step forward only; kings both ways
function directions(piece: Piece): Position[] {
  const rows = piece.king ? [-1, 1] : [FORWARD[piece.seat]];
  return rows.flatMap(row => [{ row, col: -1 }, { row, col: 1 }]);
}

function isCrowning(piece: Piece, to: Position): boolean {
  return !piece.king && to.row === crownRow(piece.seat);
}

function withSquare(board: Board, { row, col }: Position, piece: Piece | null): Board {
  return board.map((cells, r) => r === row ? cells.map((cell, c) => c === col ? piece : cell) : cells);
}

// Every complete jump sequence from the end of `path`. The jumped piece leaves the board at once, so it cannot be jumped twice.
// A man that reaches the far row is crowned and stops there.
function jumpPaths(board: Board, path: Position[], piece: Piece): Position[][] {
  const from = path[path.length - 1];
  const paths: Position[][] = [];

  for (const dir of directions(piece)) {
    const over = { row: from.row + dir.row, col: from.col + dir.col };
    const to = { row: over.row + dir.row, col: over.col + dir.col };
    const jumped = pieceAt(board, over);
    if (!isOnBoard(to) || !jumped || jumped.seat === piece.seat || pieceAt(board, to)) continue;

    const nextPath = [...path, to];
    if (isCrowning(piece, to)) {
      paths.push(nextPath);
      continue;
    }
    const nextBoard = withSquare(withSquare(withSquare(board, from, null), over, null), to, piece);
    const longer = jumpPaths(nextBoard, nextPath, piece);
    paths.push(...(longer.length > 0 ? longer : [nextPath]));
  }

  return paths;
}

function stepPaths(board: Board, from: Position, piece: Piece): Position[][] {
  return directions(piece)
    .map(dir => ({ row: from.row + dir.row, col: from.col + dir.col }))
    .filter(to => isOnBoard(to) && !pieceAt(board, to))
    .map(to => [from, to]);
}

function squaresOf(board: Board, seat: Seat): Position[] {
  return board.flatMap((cells, row) =>
    cells.flatMap((piece, col) => piece?.seat === seat ? [{ row, col }] : [])
  );
}

// Every legal turn for `seat`, each as a full path. Capturing is mandatory, so steps count only when no piece can jump.
export function getLegalMoves(board: Board, seat: Seat): Position[][] {
  const squares = squaresOf(board, seat);
  const jumps = squares.flatMap(from => jumpPaths(board, [from], pieceAt(board, from) as Piece));
  if (jumps.length > 0) return jumps;
  return squares.flatMap(from => stepPaths(board, from, pieceAt(board, from) as Piece));
}

export function isJump(path: Position[]): boolean {
  return Math.abs(path[1].row - path[0].row) === 2;
}

function capturedBy(path: Position[]): Position[] {
  if (!isJump(path)) return [];
  return path.slice(1).map((to, index) => ({
    row: (path[index].row + to.row) / 2,
    col: (path[index].col + to.col) / 2
  }));
}

// The path as sent over the network, if it is exactly one of the legal moves
function findLegalPath(legal: Position[][], input: unknown): Position[] | undefined {
  if (!Array.isArray(input)) return undefined;
  return legal.find(path => path.length === input.length && path.every((square, index) => {
    const sent = asRecord(input[index]);
    return sent?.row === square.row && sent?.col === square.col;
  }));
}

// One line about a move, used for the status and the history dialog
export function moveSummary(name: string, { captured, crowned }: Pick<LastMove, 'captured' | 'crowned'>): string {
  const action = captured.length === 0 ? 'moved'
    : captured.length === 1 ? 'captured a piece'
    : `captured ${captured.length} pieces`;
  return `${name} ${action}${crowned ? ' and crowned a king' : ''}`;
}

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), board: createBoard(), quietPlies: 0, lastMove: null };
}

// The board never changes before the first move, whoever joins or leaves
export function resetLobby(state: GameState): GameState {
  return state;
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const input = asRecord(move);
  if (input?.type !== 'move') return { error: 'Unknown move type' };
  const legal = getLegalMoves(state.board, seat);
  const path = findLegalPath(legal, input.path);
  if (!path) return { error: legal.some(isJump) ? 'Invalid move: you must capture' : 'Invalid move' };

  const from = path[0];
  const to = path[path.length - 1];
  const piece = pieceAt(state.board, from) as Piece;
  const crowned = isCrowning(piece, to);
  const captured = capturedBy(path);
  const board = withSquare(
    captured.reduce((cleared, square) => withSquare(cleared, square, null), withSquare(state.board, from, null)),
    to,
    { seat, king: piece.king || crowned }
  );
  const lastMove: LastMove = { playerNumber: seat, path, captured, crowned };
  const quietPlies = captured.length > 0 || !piece.king ? 0 : state.quietPlies + 1;
  const name = state.playerNames[seat];
  const next: GameState = {
    ...state,
    board,
    quietPlies,
    lastMove,
    gameStatus: moveSummary(name, lastMove),
    currentPlayer: nextActivePlayer(state, seat)
  };

  const opponent = next.currentPlayer as Seat;
  if (getLegalMoves(board, opponent).length === 0) {
    const reason = squaresOf(board, opponent).length === 0 ? 'has no pieces left' : 'has no legal moves';
    return {
      state: {
        ...next,
        isGameOver: true,
        currentPlayer: null,
        winners: [seat],
        gameStatus: `${name} wins! ${state.playerNames[opponent]} ${reason}.`
      }
    };
  }
  if (quietPlies >= DRAW_PLIES) {
    return {
      state: {
        ...next,
        isGameOver: true,
        currentPlayer: null,
        gameStatus: `Draw: ${DRAW_PLIES / 2} moves each without a capture or a man moving.`
      }
    };
  }
  return { state: next };
}
