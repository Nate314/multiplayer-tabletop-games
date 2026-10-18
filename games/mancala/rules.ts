// Mancala (Kalah) rules shared by the browser (board layout, playable pits) and the server (validation).
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import type { Board, GameState, PublicGameState, Result, Seat } from './types.ts';

export const PITS_PER_SIDE = 6;
export const SEEDS_PER_PIT = 4;
const HOLES = 2 * (PITS_PER_SIDE + 1);

type Side = { firstPit: number; store: number };

export const SIDES: Record<Seat, Side> = {
  1: { firstPit: 0, store: PITS_PER_SIDE },
  2: { firstPit: PITS_PER_SIDE + 1, store: HOLES - 1 }
};

export function opponentOf(seat: Seat): Seat {
  return seat === 1 ? 2 : 1;
}

// A side's pits in sowing order, which is left to right as its owner sees them
export function pitsOf(seat: Seat): number[] {
  const { firstPit } = SIDES[seat];
  return Array.from({ length: PITS_PER_SIDE }, (_, index) => firstPit + index);
}

export function storeOf(seat: Seat): number {
  return SIDES[seat].store;
}

// The pit straight across the board; pits i and 12 - i face each other
export function oppositePit(pit: number): number {
  return 2 * PITS_PER_SIDE - pit;
}

export function initialBoard(): Board {
  return Array.from({ length: HOLES }, (_, index) => (index === SIDES[1].store || index === SIDES[2].store ? 0 : SEEDS_PER_PIT));
}

export function isPlayablePit(board: Board, seat: Seat, pit: unknown): pit is number {
  return typeof pit === 'number' && pitsOf(seat).includes(pit) && board[pit] > 0;
}

function seedsOnSide(board: Board, seat: Seat): number {
  return pitsOf(seat).reduce((sum, pit) => sum + board[pit], 0);
}

// Sows counter-clockwise from `pit`, one seed per hole, skipping the opponent's store
export function sow(board: Board, seat: Seat, pit: number): { board: Board; end: number } {
  const next = [...board];
  const skipped = storeOf(opponentOf(seat));
  let seeds = next[pit];
  let hole = pit;
  next[pit] = 0;
  while (seeds > 0) {
    hole = (hole + 1) % HOLES;
    if (hole === skipped) continue;
    next[hole]++;
    seeds--;
  }
  return { board: next, end: hole };
}

// When either side runs out, each player moves the seeds left on their side into their own store
function sweepIfSideEmpty(board: Board): Board | null {
  if (seedsOnSide(board, 1) > 0 && seedsOnSide(board, 2) > 0) return null;
  const next = [...board];
  for (const seat of [1, 2]) {
    next[storeOf(seat)] += seedsOnSide(next, seat);
    for (const pit of pitsOf(seat)) next[pit] = 0;
  }
  return next;
}

function finalStatus(state: GameState, board: Board): Pick<GameState, 'winners' | 'gameStatus'> {
  const [one, two] = [board[storeOf(1)], board[storeOf(2)]];
  if (one === two) return { winners: [], gameStatus: `Draw, ${one} seeds each` };
  const winner = one > two ? 1 : 2;
  return {
    winners: [winner],
    gameStatus: `${state.playerNames[winner]} wins ${Math.max(one, two)} to ${Math.min(one, two)}!`
  };
}

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), board: initialBoard(), lastMove: null };
}

// Before the first move the board is always the starting one
export function resetLobby(state: GameState): GameState {
  return { ...state, board: initialBoard(), lastMove: null };
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const pit = asRecord(move)?.pit;
  if (!isPlayablePit(state.board, seat, pit)) return { error: 'Invalid move' };
  const name = state.playerNames[seat];
  const sown = state.board[pit];
  const { board, end } = sow(state.board, seat, pit);

  const extraTurn = end === storeOf(seat);
  let captured = 0;
  // The last seed made an empty pit of ours hold one, so it takes the pit across too, if that has seeds
  if (pitsOf(seat).includes(end) && board[end] === 1 && board[oppositePit(end)] > 0) {
    captured = board[end] + board[oppositePit(end)];
    board[storeOf(seat)] += captured;
    board[end] = 0;
    board[oppositePit(end)] = 0;
  }

  const lastMove = { playerNumber: seat, pit, end, sown, captured, extraTurn };
  const swept = sweepIfSideEmpty(board);
  if (swept) {
    return {
      state: { ...state, board: swept, lastMove, isGameOver: true, currentPlayer: null, ...finalStatus(state, swept) }
    };
  }

  let gameStatus = `${name} sowed ${sown} seeds`;
  if (extraTurn) gameStatus = `${name} gets an extra turn`;
  if (captured > 0) gameStatus = `${name} captured ${captured} seeds`;
  return {
    state: {
      ...state,
      board,
      lastMove,
      gameStatus,
      currentPlayer: extraTurn ? seat : nextActivePlayer(state, seat)
    }
  };
}
