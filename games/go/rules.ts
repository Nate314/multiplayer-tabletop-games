// Go rules shared by the browser and the server (validation)
import { applyEndingAction } from '../../shared/drawOffer.ts';
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { boardKey, emptyBoard, isOnBoard, playStone, pointName } from './board.ts';
import { BOARD_SIZE } from './options.ts';
import type { BoardSize, GameState, Point, PublicGameState, Result, Seat, Stone } from './types.ts';

// Seat 1 plays black and moves first
export function colorOf(seat: Seat): Stone {
  return seat === 1 ? 'black' : 'white';
}

// A fresh board at `size` with nothing played, drawn or marked
function freshPlay(size: BoardSize) {
  return {
    size,
    board: emptyBoard(size),
    phase: 'play' as const,
    previousKey: null,
    passes: 0,
    captures: { black: 0, white: 0 },
    dead: [],
    agreed: [],
    lastMove: null,
    score: null,
    drawOffer: null
  };
}

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), ...freshPlay(19) };
}

// Before the first move, after anyone joins or leaves: an empty board at the chosen size
export function resetLobby(state: GameState): GameState {
  return { ...state, ...freshPlay(houseRule(state, BOARD_SIZE)) };
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable, projected: null };
}

// A point from untrusted input, or null unless both coordinates are integers on the board
function asPoint(input: Record<string, unknown>, size: number): Point | null {
  const { row, col } = input;
  if (typeof row !== 'number' || typeof col !== 'number') return null;
  const point = { row, col };
  return isOnBoard(point, size) ? point : null;
}

function place(state: GameState, seat: Seat, input: Record<string, unknown>): Result<GameState> {
  const point = asPoint(input, state.size);
  if (!point) return { error: 'Invalid move' };
  if (state.phase === 'marking') return { error: 'Agree to the dead stones or resume play first' };
  const color = colorOf(seat);
  const played = playStone(state.board, point, color);
  if ('error' in played) return played;
  if (boardKey(played.board) === state.previousKey) return { error: 'Ko: play elsewhere before retaking' };
  const captured = played.captured.length;
  return {
    state: {
      ...state,
      board: played.board,
      previousKey: boardKey(state.board),
      passes: 0,
      captures: { ...state.captures, [color]: state.captures[color] + captured },
      lastMove: { type: 'place', playerNumber: seat, point, captured },
      gameStatus: `${state.playerNames[seat]} played ${pointName(point, state.size)}${captured > 0 ? ` and captured ${captured}` : ''}`,
      currentPlayer: nextActivePlayer(state, seat)
    }
  };
}

function pass(state: GameState, seat: Seat): Result<GameState> {
  if (state.phase === 'marking') return { error: 'Agree to the dead stones or resume play first' };
  const passes = state.passes + 1;
  const next: GameState = {
    ...state,
    previousKey: boardKey(state.board),
    passes,
    lastMove: { type: 'pass', playerNumber: seat },
    gameStatus: `${state.playerNames[seat]} passed`,
    currentPlayer: nextActivePlayer(state, seat)
  };
  if (passes < 2) return { state: next };
  return {
    state: { ...next, phase: 'marking', dead: [], agreed: [], gameStatus: 'Both passed. Click stones to mark them dead, then Agree' }
  };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const input = asRecord(move);
  if (input?.type === 'place') return place(state, seat, input);
  if (input?.type === 'pass') return pass(state, seat);
  return { error: 'Invalid move' };
}

export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  const type = asRecord(action)?.type;
  if (type === 'offerDraw' || type === 'answerDraw') return { error: 'Go has no draw offers' };
  return applyEndingAction(state, seat, action);
}
