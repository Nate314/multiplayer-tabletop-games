// Mancala (Kalah) rules shared by the browser (board layout, playable pits, move animation) and the server (validation).
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import type { Board, GameState, PublicGameState, Result, Seat, Transfer } from './types.ts';

export const PITS_PER_SIDE = 6;
export const STONES_PER_PIT = 4;
const HOLES = 2 * (PITS_PER_SIDE + 1);
const SEATS: Seat[] = [1, 2];

type Side = { firstPit: number; bank: number };

export const SIDES: Record<Seat, Side> = {
  1: { firstPit: 0, bank: PITS_PER_SIDE },
  2: { firstPit: PITS_PER_SIDE + 1, bank: HOLES - 1 }
};

export function opponentOf(seat: Seat): Seat {
  return seat === 1 ? 2 : 1;
}

// A side's pits in the order stones are dropped into them, which is left to right as their owner sees them
export function pitsOf(seat: Seat): number[] {
  const { firstPit } = SIDES[seat];
  return Array.from({ length: PITS_PER_SIDE }, (_, index) => firstPit + index);
}

export function bankOf(seat: Seat): number {
  return SIDES[seat].bank;
}

// The pit straight across the board; pits i and 12 - i face each other
export function oppositePit(pit: number): number {
  return 2 * PITS_PER_SIDE - pit;
}

export function stoneCount(count: number): string {
  return count === 1 ? '1 stone' : `${count} stones`;
}

// Every pit starts with four stones in the color of the player whose side it is on
export function initialBoard(): Board {
  return Array.from({ length: HOLES }, (_, hole) => {
    const seat: Seat = hole < SIDES[2].firstPit ? 1 : 2;
    return hole === bankOf(seat) ? [] : Array<Seat>(STONES_PER_PIT).fill(seat);
  });
}

export function isPlayablePit(board: Board, seat: Seat, pit: unknown): pit is number {
  return typeof pit === 'number' && pitsOf(seat).includes(pit) && board[pit].length > 0;
}

function stonesOnSide(board: Board, seat: Seat): number {
  return pitsOf(seat).reduce((sum, pit) => sum + board[pit].length, 0);
}

// Applies the transfers in order, changing the board in place
export function applyTransfers(board: Board, transfers: Transfer[]): void {
  for (const { from, to } of transfers) board[to].push(board[from].shift()!);
}

// Every stone in `holes`, hole by hole, into `to`
function emptyInto(board: Board, holes: number[], to: number): Transfer[] {
  return holes.flatMap(from => board[from].map(() => ({ from, to })));
}

export type Turn = {
  board: Board; // after the whole turn
  end: number; // where the last picked-up stone landed
  drops: Transfer[]; // the picked-up stones, one into each following hole
  capture: Transfer[];
  sweep: Transfer[]; // the end-of-game sweep of both rows into their banks
  isGameOver: boolean;
};

// Picks up every stone in `pit` and drops one into each following hole counter-clockwise, skipping the opponent's bank,
// then captures and sweeps. The move animation replays the same transfers, so every stone follows these rules.
export function playPit(board: Board, seat: Seat, pit: number): Turn {
  const next = board.map(hole => [...hole]);
  const skipped = bankOf(opponentOf(seat));
  const drops: Transfer[] = [];
  let end = pit;
  for (let left = board[pit].length; left > 0; left--) {
    do end = (end + 1) % HOLES; while (end === skipped);
    drops.push({ from: pit, to: end });
  }
  applyTransfers(next, drops);

  // The last stone made an empty pit of ours hold one, so it takes the pit across too, if that has stones
  const across = oppositePit(end);
  const captures = pitsOf(seat).includes(end) && next[end].length === 1 && next[across].length > 0;
  const capture = captures ? emptyInto(next, [end, across], bankOf(seat)) : [];
  applyTransfers(next, capture);

  // When either row runs out, each player moves the stones left on their side into their own bank
  const isGameOver = stonesOnSide(next, 1) === 0 || stonesOnSide(next, 2) === 0;
  const sweep = isGameOver ? SEATS.flatMap(owner => emptyInto(next, pitsOf(owner), bankOf(owner))) : [];
  applyTransfers(next, sweep);
  return { board: next, end, drops, capture, sweep, isGameOver };
}

function finalStatus(state: GameState, board: Board): Pick<GameState, 'winners' | 'gameStatus'> {
  const [one, two] = [board[bankOf(1)].length, board[bankOf(2)].length];
  if (one === two) return { winners: [], gameStatus: `Draw, ${stoneCount(one)} each` };
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
  const { board, end, drops, capture, isGameOver } = playPit(state.board, seat, pit);
  const extraTurn = end === bankOf(seat);
  const lastMove = { playerNumber: seat, pit, end, pickedUp: drops.length, captured: capture.length, extraTurn };
  if (isGameOver) {
    return { state: { ...state, board, lastMove, isGameOver, currentPlayer: null, ...finalStatus(state, board) } };
  }

  let gameStatus = `${name} picked up ${stoneCount(drops.length)}`;
  if (extraTurn) gameStatus = `${name} gets an extra turn`;
  if (capture.length > 0) gameStatus = `${name} captured ${stoneCount(capture.length)}`;
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
