// Ultimate Tic-Tac-Toe rules shared by the browser (move summaries, board results) and the server (validation).
import { applyEndingAction, endGame, lapseDrawOffer } from '../../shared/drawOffer.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { CELL_NAMES, emptyCells, findLine, isCellIndex, isFull } from '../tictactoe/lines.ts';
import type { Cells } from '../tictactoe/lines.ts';
import { markOf, withFirstMark, xSeatFor } from '../tictactoe/marks.ts';
import type { Mark } from '../tictactoe/marks.ts';
import type { BoardResult, GameState, PublicGameState, Result, Seat } from './types.ts';

export function createGameState(gameId: string): GameState {
  const base = baseGameState(gameId);
  return {
    ...base,
    xSeat: xSeatFor(base.gameNumber),
    boards: Array.from({ length: 9 }, emptyCells),
    forcedBoard: null,
    lastMove: null,
    winningLine: null,
    drawOffer: null
  };
}

// X moves first, and each rematch swaps the marks, so the first turn depends on the game number
export function resetLobby(state: GameState): GameState {
  return withFirstMark(state);
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

// A line beats full: a board with three in a row is claimed even when its last cell is filled
export function boardResult(cells: Cells): BoardResult {
  const won = findLine(cells);
  if (won) return won.seat;
  return isFull(cells) ? 'draw' : null;
}

export function boardResults(state: Pick<GameState, 'boards'>): BoardResult[] {
  return state.boards.map(boardResult);
}

// The forced board, else every board still open
export function playableBoards(state: Pick<GameState, 'boards' | 'forcedBoard'>): number[] {
  if (state.forcedBoard !== null) return [state.forcedBoard];
  return boardResults(state).flatMap((result, board) => result === null ? [board] : []);
}

// One line about a move, used for the status and the history dialog
export function moveSummary(name: string, mark: Mark, board: number, cell: number, claimed: boolean): string {
  return `${name} placed ${mark} in the ${CELL_NAMES[cell]} of the ${CELL_NAMES[board]} board${claimed ? ' and claimed it' : ''}`;
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const input = asRecord(move);
  if (input?.type !== 'place') return { error: 'Unknown move type' };
  if (!isCellIndex(input.board)) return { error: 'Invalid board' };
  if (!isCellIndex(input.cell)) return { error: 'Invalid cell' };
  const { board, cell } = input;
  if (boardResult(state.boards[board]) !== null) return { error: 'That board is decided' };
  if (state.forcedBoard !== null && board !== state.forcedBoard) return { error: 'Play in the highlighted board' };
  if (state.boards[board][cell] !== null) return { error: 'That cell is taken' };

  const marked = state.boards[board].map((held, i) => i === cell ? seat : held);
  const boards = state.boards.map((cells, i) => i === board ? marked : cells);
  const claimed = boardResult(marked) === seat;
  const name = state.playerNames[seat];
  const next: GameState = lapseDrawOffer({
    ...state,
    boards,
    forcedBoard: boardResult(boards[cell]) === null ? cell : null,
    lastMove: { playerNumber: seat, board, cell, claimed },
    gameStatus: moveSummary(name, markOf(state, seat), board, cell, claimed),
    currentPlayer: nextActivePlayer(state, seat)
  }, seat);

  // Drawn boards count for nobody; a line is checked before the draw so the last board can still win
  const results = boardResults(next);
  const won = findLine(results.map(result => result === 'draw' ? null : result));
  if (won) return { state: { ...endGame(next, [seat], `${name} wins with three boards in a row!`), winningLine: [...won.line] } };
  if (results.every(result => result !== null)) return { state: endGame(next, [], 'Every board is decided with no line. Draw.') };
  return { state: next };
}

// Resigning and draws by agreement, the shared ending actions
export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  return applyEndingAction(state, seat, action);
}
