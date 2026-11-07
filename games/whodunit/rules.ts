// Whodunit rules: the deal, turns, suggestions, showing and accusations
import { rollDice } from '../../shared/dice.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState } from '../../shared/seating.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random } from '../../shared/types.ts';
import { PASSAGES, STARTS } from './board.ts';
import type { Cell, Position } from './board.ts';
import { CARDS, OBJECTS, ROOMS, SUSPECTS, nameOf } from './content.ts';
import type { CardId, ObjectId, RoomId, SuspectId } from './content.ts';
import { destinations } from './movement.ts';
import type { GameState, LastMove, Mark, Move, PublicGameState, Result, Seat, Suggestion } from './types.ts';

const MARKS: readonly Mark[] = ['yes', 'no', 'maybe'];
const isSuspect = (value: unknown): value is SuspectId => SUSPECTS.some(s => s.id === value);
const isObject = (value: unknown): value is ObjectId => OBJECTS.some(o => o.id === value);
const isRoom = (value: unknown): value is RoomId => ROOMS.some(r => r.id === value);
const isCard = (value: unknown): value is CardId => CARDS.includes(value as CardId);
const samePosition = (a: Position, b: Position) => ('room' in a ? 'room' in b && a.room === b.room : !('room' in b) && a.row === b.row && a.col === b.col);
const roomOf = (position: Position): RoomId | null => ('room' in position ? position.room : null);
const perSeat = <T>(seats: Seat[], make: () => T): Record<Seat, T> => Object.fromEntries(seats.map(seat => [seat, make()]));

function fresh(seats: Seat[]) {
  return {
    solution: null,
    hands: perSeat<CardId[]>(seats, () => []),
    faceUp: perSeat<CardId[]>(seats, () => []),
    suspectOf: Object.fromEntries(seats.map(seat => [seat, SUSPECTS[seat - 1].id])),
    positions: { ...STARTS } as Record<SuspectId, Position>,
    objectRooms: Object.fromEntries(OBJECTS.map((o, i) => [o.id, ROOMS[i].id])) as Record<ObjectId, RoomId>,
    phase: 'start' as const,
    dice: null,
    destinations: [],
    leftRoom: null,
    movedIn: [],
    suggestions: [],
    seen: [],
    accusations: [],
    out: [],
    notes: perSeat(seats, () => ({})),
    lastMove: null
  };
}

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), ...fresh([]) };
}

// Runs after every join and leave before play, so the deal always fits the seats
export function resetLobby(state: GameState, random: Random): GameState {
  const seats = state.activePlayers;
  const pick = <T extends { id: string }>(items: readonly T[]): T['id'] => items[Math.floor(random() * items.length)].id;
  const solution = { suspect: pick(SUSPECTS), object: pick(OBJECTS), room: pick(ROOMS) };
  const rest = shuffle(CARDS.filter(card => card !== solution.suspect && card !== solution.object && card !== solution.room), random);
  const base = fresh(seats);
  if (seats.length > 0) rest.forEach((card, i) => base.hands[seats[i % seats.length]].push(card));
  const rooms = shuffle(ROOMS, random);
  const objectRooms = Object.fromEntries(OBJECTS.map((o, i) => [o.id, rooms[i].id])) as Record<ObjectId, RoomId>;
  return { ...state, ...base, solution, objectRooms, currentPlayer: seats[0] ?? null };
}

// Placeholder until the views task: shows no hand, no shown card and no solution
export function toPublicState(state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> {
  const { hands: _hands, seen: _seen, notes: _notes, ...rest } = state;
  return { ...rest, undoAvailable, solution: null, hand: [], handSizes: {}, seen: [], notes: {} };
}

export const canAccuse = (state: GameState): Seat[] => state.activePlayers.filter(seat => !state.out.includes(seat));

// The other seated players clockwise, in seat order after the suggester
export function holderOrder(state: GameState, suggester: Seat): Seat[] {
  const seats = state.activePlayers;
  return [...seats.filter(seat => seat > suggester), ...seats.filter(seat => seat < suggester)];
}

export function nextTurn(state: GameState, after: Seat): GameState {
  const left = canAccuse(state);
  const next = left.find(seat => seat > after) ?? left[0] ?? null;
  const ending = state.suspectOf[after];
  return { ...state, currentPlayer: next, phase: 'start', dice: null, destinations: [], leftRoom: null, movedIn: state.movedIn.filter(s => s !== ending) };
}

export function settleEnd(state: GameState): GameState {
  const left = canAccuse(state);
  if (left.length >= 2) return state;
  const over = { ...state, isGameOver: true, currentPlayer: null, winners: left };
  return { ...over, gameStatus: left.length === 1 ? `${state.playerNames[left[0]]} wins: everyone else is out` : 'Nobody solved it' };
}

export function waitingOn(state: GameState): Seat[] {
  const awaiting = state.phase === 'showing' ? state.suggestions.at(-1)?.awaiting : null;
  return awaiting ? [awaiting] : [];
}

export function allowsOutOfTurn(state: GameState, seat: Seat, move: unknown): boolean {
  return asRecord(move)?.type === 'show' && waitingOn(state).includes(seat);
}

const moved = (state: GameState, seat: Seat, to: Position, phase: GameState['phase'], extra: Partial<GameState> = {}): GameState => ({
  ...state, ...extra, phase, positions: { ...state.positions, [state.suspectOf[seat]]: to }
});

function step(state: GameState, lastMove: LastMove, gameStatus: string): GameState {
  return { ...state, lastMove, gameStatus };
}

function roll(state: GameState, seat: Seat, random: Random): Result<GameState> {
  const [a, b] = rollDice(2, random);
  const mine = state.suspectOf[seat];
  const occupied = SUSPECTS.filter(s => s.id !== mine).map(s => state.positions[s.id]).filter((p): p is Cell => !('room' in p));
  const options = destinations(state.positions[mine], a + b, occupied, state.leftRoom);
  const name = state.playerNames[seat];
  const status = `${name} rolled ${a + b}${options.length === 0 ? ' and has nowhere to go' : ''}`;
  return { state: step({ ...state, phase: 'move', dice: [a, b], destinations: options }, { type: 'roll', playerNumber: seat, dice: [a, b] }, status) };
}

function moveTo(state: GameState, seat: Seat, to: unknown): Result<GameState> {
  const target = state.destinations.find(d => {
    const input = asRecord(to);
    return input !== null && samePosition(d, input as Position);
  });
  if (!target) return { error: 'Not a square you can reach' };
  const room = roomOf(target);
  const from = roomOf(state.positions[state.suspectOf[seat]]);
  const next = moved(state, seat, target, room ? 'room' : 'end', { destinations: [], leftRoom: from ?? state.leftRoom });
  const name = state.playerNames[seat];
  return { state: step(next, { type: 'moveTo', playerNumber: seat, to: target }, room ? `${name} entered the ${nameOf(room)}` : `${name} moved`) };
}

// Each holder clockwise either passes, shows their one match at once, or must choose between several
function resolveShowing(state: GameState, by: Seat, suggestion: Omit<Suggestion, 'passed' | 'shownBy' | 'awaiting'>): GameState {
  const asked: CardId[] = [suggestion.suspect, suggestion.object, suggestion.room];
  const index = state.suggestions.length;
  const passed: Seat[] = [];
  for (const holder of holderOrder(state, by)) {
    const matches = state.hands[holder].filter(card => asked.includes(card));
    if (matches.length === 0) { passed.push(holder); continue; }
    const name = state.playerNames[holder];
    if (matches.length > 1) {
      const entry = { ...suggestion, passed, shownBy: null, awaiting: holder };
      return { ...state, phase: 'showing', suggestions: [...state.suggestions, entry], gameStatus: `${state.gameStatus}: ${name} is choosing a card to show` };
    }
    const entry = { ...suggestion, passed, shownBy: holder, awaiting: null };
    return {
      ...state,
      phase: 'end',
      suggestions: [...state.suggestions, entry],
      seen: [...state.seen, { suggestion: index, from: holder, to: by, card: matches[0] }],
      lastMove: { ...state.lastMove!, sealed: true },
      gameStatus: `${state.gameStatus}: ${name} showed a card`
    };
  }
  const entry = { ...suggestion, passed, shownBy: null, awaiting: null };
  return { ...state, phase: 'end', suggestions: [...state.suggestions, entry], gameStatus: `${state.gameStatus}: nobody could show a card` };
}

function suggest(state: GameState, seat: Seat, input: Record<string, unknown>): Result<GameState> {
  const { suspect, object } = input;
  if (!isSuspect(suspect) || !isObject(object)) return { error: 'Invalid move' };
  const room = roomOf(state.positions[state.suspectOf[seat]]);
  if (!room) return { error: 'Suggest from inside a room' };
  if (state.phase !== 'room') return { error: 'Not now' };
  const movedIn = suspect === state.suspectOf[seat] || state.movedIn.includes(suspect) ? state.movedIn : [...state.movedIn, suspect];
  const next = {
    ...state,
    movedIn,
    positions: { ...state.positions, [suspect]: { room } },
    objectRooms: { ...state.objectRooms, [object]: room }
  };
  const status = `${state.playerNames[seat]} suggests ${nameOf(suspect)} with the ${nameOf(object)} in the ${nameOf(room)}`;
  return { state: resolveShowing(step(next, { type: 'suggest', playerNumber: seat }, status), seat, { suspect, object, room, by: seat }) };
}

function show(state: GameState, seat: Seat, card: unknown): Result<GameState> {
  const suggestion = state.suggestions.at(-1)!;
  const asked: unknown[] = [suggestion.suspect, suggestion.object, suggestion.room];
  if (!asked.includes(card) || !state.hands[seat].includes(card as CardId)) return { error: 'Show one of the cards asked about' };
  const suggestions = [...state.suggestions.slice(0, -1), { ...suggestion, shownBy: seat, awaiting: null }];
  const seen = [...state.seen, { suggestion: state.suggestions.length - 1, from: seat, to: suggestion.by, card: card as CardId }];
  const status = `${state.playerNames[seat]} showed ${state.playerNames[suggestion.by]} a card`;
  return { state: step({ ...state, phase: 'end', suggestions, seen }, { type: 'show', playerNumber: seat, sealed: true }, status) };
}

function accuse(state: GameState, seat: Seat, input: Record<string, unknown>): Result<GameState> {
  const { suspect, object, room } = input;
  if (!isSuspect(suspect) || !isObject(object) || !isRoom(room)) return { error: 'Invalid move' };
  const solution = state.solution!;
  const correct = suspect === solution.suspect && object === solution.object && room === solution.room;
  const name = state.playerNames[seat];
  const next = step({ ...state, accusations: [...state.accusations, { suspect, object, room, by: seat, correct }] }, { type: 'accuse', playerNumber: seat, sealed: true }, '');
  if (correct) {
    return { state: { ...next, isGameOver: true, currentPlayer: null, winners: [seat], gameStatus: `${name} solved it: ${nameOf(suspect)} with the ${nameOf(object)} in the ${nameOf(room)}` } };
  }
  const settled = settleEnd({ ...next, out: [...state.out, seat], gameStatus: `${name} accused wrongly and is out of turns` });
  return { state: settled.isGameOver ? settled : nextTurn(settled, seat) };
}

export function applyMove(state: GameState, seat: Seat, move: unknown, random: Random): Result<GameState> {
  const input = asRecord(move);
  const type = input?.type as Move['type'] | undefined;
  if (!input || !type) return { error: 'Invalid move' };
  if (state.phase === 'showing') {
    if (type !== 'show' || !waitingOn(state).includes(seat)) return { error: 'Wait for the card to be shown' };
    return show(state, seat, input.card);
  }
  const here = state.positions[state.suspectOf[seat]];
  const room = roomOf(here);
  const name = state.playerNames[seat];
  switch (type) {
    case 'roll':
      return state.phase === 'start' ? roll(state, seat, random) : { error: 'Not now' };
    case 'passage': {
      if (state.phase !== 'start') return { error: 'Not now' };
      const to = room && PASSAGES[room];
      if (!to) return { error: 'No secret passage here' };
      return { state: step(moved(state, seat, { room: to }, 'room', { leftRoom: room }), { type: 'passage', playerNumber: seat, to: { room: to } }, `${name} took the secret passage to the ${nameOf(to)}`) };
    }
    case 'stay':
      if (state.phase !== 'start') return { error: 'Not now' };
      if (!room || !state.movedIn.includes(state.suspectOf[seat])) return { error: 'You can stay only in a room a suggestion moved you into' };
      return { state: step({ ...state, phase: 'room' }, { type: 'stay', playerNumber: seat }, `${name} stays in the ${nameOf(room)}`) };
    case 'moveTo':
      if (state.phase === 'start') return { error: 'Roll first' };
      return state.phase === 'move' ? moveTo(state, seat, input.to) : { error: 'Not now' };
    case 'stayPut':
      if (state.phase === 'start') return { error: 'Roll first' };
      if (state.phase !== 'move' || state.destinations.length > 0) return { error: 'Not now' };
      return { state: step({ ...state, phase: room ? 'room' : 'end' }, { type: 'stayPut', playerNumber: seat }, `${name} stays put`) };
    case 'suggest':
      return suggest(state, seat, input);
    case 'show':
      return { error: 'Not now' };
    case 'accuse':
      return state.phase === 'move' ? { error: 'Not now' } : accuse(state, seat, input);
    case 'endTurn':
      if (state.phase !== 'room' && state.phase !== 'end') return { error: 'Not now' };
      return { state: nextTurn(step(state, { type: 'endTurn', playerNumber: seat }, `${name} ended their turn`), seat) };
    default:
      return { error: 'Invalid move' };
  }
}

// A note is private and not recorded for undo
export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  const input = asRecord(action);
  const mark = input?.mark;
  if (input?.type !== 'note' || !isCard(input.card) || !(mark === null || MARKS.includes(mark as Mark))) return { error: 'Invalid action' };
  if (!state.activePlayers.includes(seat)) return { error: 'Invalid action' };
  if (state.isGameOver) return { error: 'Not now' };
  const notes = { ...state.notes[seat] };
  if (mark === null) delete notes[input.card];
  else notes[input.card] = mark as Mark;
  return { state: { ...state, notes: { ...state.notes, [seat]: notes } } };
}
