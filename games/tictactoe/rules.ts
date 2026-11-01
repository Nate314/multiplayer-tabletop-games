// Tic-Tac-Toe rules shared by the browser (move summaries) and the server (validation).
import { applyEndingAction, endGame, lapseDrawOffer } from '../../shared/drawOffer.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { CELL_NAMES, emptyCells, findLine, isCellIndex, isFull } from './lines.ts';
import { markOf, withFirstMark, xSeatFor } from './marks.ts';
import type { Mark } from './marks.ts';
import type { GameState, PublicGameState, Result, Seat } from './types.ts';

export function createGameState(gameId: string): GameState {
  const base = baseGameState(gameId);
  return { ...base, xSeat: xSeatFor(base.gameNumber), board: emptyCells(), lastMove: null, winningLine: null, drawOffer: null };
}

// X moves first, and each rematch swaps the marks, so the first turn depends on the game number
export function resetLobby(state: GameState): GameState {
  return withFirstMark(state);
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

// One line about a move, used for the status and the history dialog
export function moveSummary(name: string, mark: Mark, cell: number): string {
  return `${name} placed ${mark} in the ${CELL_NAMES[cell]}`;
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const input = asRecord(move);
  if (input?.type !== 'place') return { error: 'Unknown move type' };
  if (!isCellIndex(input.cell)) return { error: 'Invalid cell' };
  const cell = input.cell;
  if (state.board[cell] !== null) return { error: 'That cell is taken' };

  const board = state.board.map((held, i) => i === cell ? seat : held);
  const name = state.playerNames[seat];
  const next: GameState = lapseDrawOffer({
    ...state,
    board,
    lastMove: { playerNumber: seat, cell },
    gameStatus: moveSummary(name, markOf(state, seat), cell),
    currentPlayer: nextActivePlayer(state, seat)
  }, seat);

  const won = findLine(board);
  if (won) return { state: { ...endGame(next, [seat], `${name} wins with three in a row!`), winningLine: [...won.line] } };
  if (isFull(board)) return { state: endGame(next, [], 'The board is full. Draw.') };
  return { state: next };
}

// Resigning and draws by agreement, the shared ending actions
export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  return applyEndingAction(state, seat, action);
}
