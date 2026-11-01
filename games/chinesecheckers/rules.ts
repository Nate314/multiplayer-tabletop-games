// Chinese Checkers rules shared by the browser (move hints) and the server (validation).
import { rankStandings } from '../../shared/standings.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState } from '../../shared/seating.ts';
import { plural } from '../../shared/text.ts';
import type { Standing } from '../../shared/types.ts';
import { DIRECTIONS, PLAYABLE_COUNTS, POINT_HOLES, START_POINTS, holeKey, isHole, neighbors, opposite, parseHole } from './board.ts';
import type { GameState, Hole, LastMove, PointIndex, PublicGameState, Result, Seat } from './types.ts';

export const MARBLE_COUNT = 10;

export const SEAT_COLORS: Record<Seat, string> = { 1: 'Red', 2: 'Blue', 3: 'Green', 4: 'Yellow', 5: 'Purple', 6: 'Orange' };

const NEEDS_PLAYABLE_COUNT = 'Chinese Checkers needs 2, 3, 4 or 6 players';

const isPlayable = (state: GameState): boolean => PLAYABLE_COUNTS.includes(state.activePlayers.length);

// Only for a seat that still has a point
export function targetOf(state: GameState, seat: Seat): PointIndex {
  return opposite(state.points[seat] as PointIndex);
}

export function marblesHome(state: GameState, seat: Seat): number {
  if (state.points[seat] === undefined) return 0;
  return POINT_HOLES[targetOf(state, seat)].filter(hole => state.holes[holeKey(hole)] === seat).length;
}

// Every hole of the target is taken and at least one by the seat's own marble: opponents left there count for it
export function hasWon(state: GameState, seat: Seat): boolean {
  if (state.points[seat] === undefined) return false;
  const target = POINT_HOLES[targetOf(state, seat)];
  return target.every(hole => state.holes[holeKey(hole)] !== undefined) && marblesHome(state, seat) > 0;
}

const sameHole = (a: Hole, b: Hole): boolean => a.q === b.q && a.r === b.r;
const add = (a: Hole, b: Hole, times = 1): Hole => ({ q: a.q + b.q * times, r: a.r + b.r * times });

export function isStep(path: Hole[]): boolean {
  return path.length === 2 && neighbors(path[0]).some(hole => sameHole(hole, path[1]));
}

// Where the marble moving along `path` may land next. The hole it left is empty while it moves,
// and it never lands on a hole of its path again, its start included.
export function nextLandings(state: GameState, path: Hole[]): Hole[] {
  const [start] = path;
  const from = path[path.length - 1];
  if (path.length > 1 && isStep(path.slice(0, 2))) return [];
  const isEmpty = (hole: Hole) => sameHole(hole, start) || state.holes[holeKey(hole)] === undefined;
  const isNew = (hole: Hole) => !path.some(visited => sameHole(visited, hole));
  const steps = path.length === 1 ? neighbors(from).filter(isEmpty) : [];
  const hops = DIRECTIONS
    .filter(direction => !isEmpty(add(from, direction)))
    .map(direction => add(from, direction, 2))
    .filter(landing => isHole(landing) && isEmpty(landing));
  return [...steps, ...hops].filter(isNew);
}

export function isLegalPath(state: GameState, seat: Seat, path: Hole[]): boolean {
  if (path.length < 2 || !isHole(path[0]) || state.holes[holeKey(path[0])] !== seat) return false;
  return path.slice(1).every((hole, index) =>
    nextLandings(state, path.slice(0, index + 1)).some(landing => sameHole(landing, hole)));
}

export function hasAnyMove(state: GameState, seat: Seat): boolean {
  return Object.entries(state.holes).some(([key, owner]) => {
    if (owner !== seat) return false;
    return nextLandings(state, [parseHole(key)]).length > 0;
  });
}

function asPath(value: unknown): Hole[] | null {
  if (!Array.isArray(value)) return null;
  const path = value.map(asRecord);
  return path.every(hole => Number.isInteger(hole?.q) && Number.isInteger(hole?.r))
    ? path.map(hole => ({ q: hole?.q as number, r: hole?.r as number }))
    : null;
}

export function moveSummary(name: string, lastMove: LastMove, won: boolean): string {
  const moved = isStep(lastMove.path) ? 'moved a marble' : `made ${plural(lastMove.path.length - 1, 'jump')}`;
  return `${name} ${moved}${won ? ' and won' : ''}`;
}

// Names joined for a sentence, e.g. 'Alice', 'Alice and Bob' or 'Alice, Bob and Cara'
function namesOf(state: GameState, seats: Seat[]): string {
  const names = seats.map(seat => state.playerNames[seat]);
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// The seated players from `from` on, round the table in seat order
function seatsFrom(state: GameState, from: Seat): Seat[] {
  return [...state.activePlayers.filter(seat => seat >= from), ...state.activePlayers.filter(seat => seat < from)];
}

// Gives the turn to the first of `order` with a move, each one passed over saying so.
// When nobody can move, the most marbles home win.
function giveTurn(state: GameState, order: Seat[], notes: string[]): GameState {
  const status = [...notes];
  for (const seat of order) {
    if (hasAnyMove(state, seat)) return { ...state, currentPlayer: seat, gameStatus: status.join('. ') };
    status.push(`${state.playerNames[seat]} has no move and passes`);
  }
  const most = Math.max(...state.activePlayers.map(seat => marblesHome(state, seat)));
  const winners = state.activePlayers.filter(seat => marblesHome(state, seat) === most);
  return {
    ...state,
    isGameOver: true,
    currentPlayer: null,
    winners,
    gameStatus: `Nobody can move. ${namesOf(state, winners)} win with the most marbles home`
  };
}

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), holes: {}, points: {}, lastMove: null };
}

// Seats take the start points in seat order, so turns run clockwise, and each point fills with its seat's marbles.
// Five seated players cannot start, so the board stays empty.
export function resetLobby(state: GameState): GameState {
  const starts = START_POINTS[state.activePlayers.length as keyof typeof START_POINTS] ?? [];
  const seated = state.activePlayers.slice(0, starts.length);
  return {
    ...state,
    points: Object.fromEntries(seated.map((seat, index) => [seat, starts[index]])),
    holes: Object.fromEntries(seated.flatMap((seat, index) => POINT_HOLES[starts[index]].map(hole => [holeKey(hole), seat]))),
    lastMove: null,
    gameStatus: state.activePlayers.length === 5 ? NEEDS_PLAYABLE_COUNT : state.gameStatus
  };
}

// The leaver's marbles come off the board; a turn that cannot be played (theirs, or one lost with their marbles) moves on
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const holes = Object.fromEntries(Object.entries(state.holes).filter(([, owner]) => owner !== seat));
  const points = { ...state.points };
  delete points[seat];
  const next = { ...state, holes, points };
  const current = next.currentPlayer;
  if (!next.started || next.isGameOver || current === null || hasAnyMove(next, current)) return next;
  return giveTurn(next, seatsFrom(next, current), [next.gameStatus]);
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  return { ...state, undoAvailable };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  // A table that drops to five after the first move plays on
  if (!state.started && !isPlayable(state)) return { error: NEEDS_PLAYABLE_COUNT };
  const input = asRecord(move);
  if (input?.type !== 'move') return { error: 'Unknown move type' };
  const path = asPath(input.path);
  if (!path || !isLegalPath(state, seat, path)) return { error: 'Invalid move' };

  const holes = { ...state.holes };
  delete holes[holeKey(path[0])];
  holes[holeKey(path[path.length - 1])] = seat;
  const lastMove: LastMove = { playerNumber: seat, path };
  const next: GameState = { ...state, holes, lastMove };
  const name = state.playerNames[seat];

  if (hasWon(next, seat)) {
    return {
      state: { ...next, isGameOver: true, winners: [seat], currentPlayer: null, gameStatus: `${name} filled the far point and wins!` }
    };
  }
  // The mover comes last, so they move again only when nobody else can
  return { state: giveTurn(next, seatsFrom(next, seat + 1), [moveSummary(name, lastMove, false)]) };
}

export function finalStandings(state: GameState): Standing[] {
  const home = (seat: Seat) => marblesHome(state, seat);
  return rankStandings(state, (a, b) => home(b) - home(a), seat => `${home(seat)} of ${MARBLE_COUNT} marbles home`);
}
