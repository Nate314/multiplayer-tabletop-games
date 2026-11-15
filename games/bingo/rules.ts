// Bingo: players take turns calling the next number, mark it on their own cards and claim a Bingo.
// A claim opens a place that stays open until the next Call or PLACE_WINDOW_MS, so near-simultaneous claims share it.
import { houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState, nextActivePlayer } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import { rankStandings } from '../../shared/standings.ts';
import type { Random, Result, Seat, Standing } from '../../shared/types.ts';
import { dealCard, hasPattern, letterOf } from './cards.ts';
import { CARDS_RULE, PATTERN_RULE, PLAY_UNTIL_RULE } from './options.ts';
import type { GameState, PublicGameState } from './types.ts';

export const PLACE_WINDOW_MS = 3000;
export const FINAL_WINDOW_MS = 10000;
const NUMBERS = 75;

export function createGameState(gameId: string): GameState {
  return {
    ...baseGameState(gameId), pool: [], called: [], cards: {}, marks: {}, places: {}, openPlace: null, finalUntil: null, lastMove: null
  };
}

export function resetLobby(state: GameState, random: Random): GameState {
  const count = houseRule(state, CARDS_RULE);
  const seats = state.activePlayers;
  return {
    ...state,
    pool: shuffle(Array.from({ length: NUMBERS }, (_, i) => i + 1), random),
    called: [],
    cards: Object.fromEntries(seats.map(seat => [seat, Array.from({ length: count }, () => dealCard(random))])),
    marks: Object.fromEntries(seats.map(seat => [seat, Array.from({ length: count }, () => [])])),
    places: {},
    openPlace: null,
    finalUntil: null,
    lastMove: null
  };
}

const nameOf = (state: GameState, seat: Seat): string => state.playerNames[seat];

function endGame(state: GameState): GameState {
  // A seat that left keeps the place it won, so it counts here though no longer active
  const winners = Object.keys(state.places).map(Number).filter(seat => state.places[seat] === 1);
  const gameStatus = winners.length ? `${winners.map(seat => nameOf(state, seat)).join(' and ')} won` : 'Nobody got a Bingo';
  return { ...state, openPlace: null, finalUntil: null, currentPlayer: null, isGameOver: true, winners, gameStatus };
}

const everyonePlaced = (state: GameState): boolean => state.activePlayers.every(seat => state.places[seat] !== undefined);

// Closes the open place, and ends the game when it was the last one wanted
function closePlace(state: GameState): GameState {
  if (!state.openPlace) return state;
  const closed = { ...state, openPlace: null };
  return state.openPlace.place >= houseRule(state, PLAY_UNTIL_RULE) || everyonePlaced(closed) ? endGame(closed) : closed;
}

export function applyMove(state: GameState, seat: Seat, move: unknown, _random: Random, now: number): Result<GameState> {
  if (asRecord(move)?.type !== 'call' || Array.isArray(move)) return { error: 'Invalid move' };
  const closed = closePlace(state);
  if (closed.isGameOver) return { state: closed };
  const [number, ...pool] = closed.pool;
  if (number === undefined) return { error: 'No numbers left' };
  return {
    state: {
      ...closed,
      pool,
      called: [...closed.called, number],
      finalUntil: pool.length === 0 ? now + FINAL_WINDOW_MS : closed.finalUntil,
      currentPlayer: nextActivePlayer(closed, seat),
      lastMove: { type: 'call', seat, number },
      gameStatus: `${nameOf(closed, seat)} called ${letterOf(number)} ${number}`
    }
  };
}

const isIndex = (value: unknown, length: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < length;

function mark(state: GameState, seat: Seat, card: unknown, square: unknown): Result<GameState> {
  const cards = state.cards[seat];
  if (!isIndex(card, cards.length)) return { error: 'No such card' };
  if (!isIndex(square, 25) || square === 12) return { error: 'No such square' };
  if (!state.called.includes(cards[card][square])) return { error: 'That number has not been called' };
  const marked = state.marks[seat][card];
  if (marked.includes(square)) return { error: 'Already marked' };
  const marks = { ...state.marks, [seat]: state.marks[seat].map((squares, i) => (i === card ? [...marked, square] : squares)) };
  return { state: { ...state, marks } };
}

function claim(state: GameState, seat: Seat, now: number): Result<GameState> {
  const pattern = houseRule(state, PATTERN_RULE);
  if (!state.cards[seat].some((card, i) => hasPattern(card, state.marks[seat][i], pattern))) return { error: 'Not a Bingo yet' };
  const awarded = Math.max(0, ...Object.values(state.places));
  const openPlace = state.openPlace ?? { place: awarded + 1, closesAt: now + PLACE_WINDOW_MS };
  const places = { ...state.places, [seat]: openPlace.place };
  const next: GameState = {
    ...state, places, openPlace,
    lastMove: { type: 'bingo', seat, place: openPlace.place },
    gameStatus: `${nameOf(state, seat)} called Bingo`
  };
  return { state: everyonePlaced(next) ? endGame(next) : next };
}

export function applyAction(state: GameState, seat: Seat, action: unknown, _random: Random, now: number): Result<GameState> {
  const record = asRecord(action);
  if (!record || Array.isArray(action)) return { error: 'Invalid action' };
  if (state.isGameOver) return { error: 'The game is over' };
  if (!state.activePlayers.includes(seat)) return { error: 'You are not in this game' };
  if (state.places[seat] !== undefined) return { error: 'You already have a place' };
  // A window that ran out but has not been closed by the clock yet is closed here
  const current = state.openPlace && now >= state.openPlace.closesAt ? closePlace(state) : state;
  if (current.isGameOver) return { error: 'The game is over' };
  if (record.type === 'mark') return mark(current, seat, record.card, record.square);
  if (record.type === 'bingo') return claim(current, seat, now);
  return { error: 'Invalid action' };
}

export const recordsAction = (_state: GameState, _seat: Seat, action: unknown): boolean => asRecord(action)?.type === 'bingo';

export const deadline = (state: GameState): number | null => state.openPlace?.closesAt ?? state.finalUntil;

export function onDeadline(state: GameState): GameState {
  return state.openPlace ? closePlace(state) : endGame(state);
}

// A restart or an undo gives a window that was open its full time again
export function resumeClock(state: GameState, now: number): GameState {
  if (state.isGameOver) return state;
  return {
    ...state,
    openPlace: state.openPlace && { ...state.openPlace, closesAt: now + PLACE_WINDOW_MS },
    finalUntil: state.finalUntil === null ? null : now + FINAL_WINDOW_MS
  };
}

// Undoing a call must not reveal what comes next
export const onUndo = (state: GameState, random: Random): GameState => ({ ...state, pool: shuffle(state.pool, random) });

export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const omit = <T>(record: Record<Seat, T>): Record<Seat, T> =>
    Object.fromEntries(Object.entries(record).filter(([key]) => Number(key) !== seat));
  const left = { ...state, cards: omit(state.cards), marks: omit(state.marks) };
  return everyonePlaced(left) ? endGame(left) : left;
}

export function finalStandings(state: GameState): Standing[] {
  const rank = (seat: Seat) => state.places[seat] ?? Infinity;
  return rankStandings(state, (a, b) => (rank(a) === rank(b) ? 0 : rank(a) - rank(b)));
}

export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  const { pool: _pool, ...view } = state;
  return { ...view, undoAvailable };
}
