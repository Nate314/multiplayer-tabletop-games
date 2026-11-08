// Steady Hand rules: turns are recorded moves (out or buzz, judged in the dragger's browser); pick, drag and drop are
// unrecorded live actions that only stream the held part's position to everyone else
import { agreementPending, houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { baseGameState } from '../../shared/seating.ts';
import { pointsText, rankStandings } from '../../shared/standings.ts';
import type { Standing } from '../../shared/types.ts';
import { PARTS } from './board.ts';
import { steadyhandInfo } from './info.ts';
import { BUZZES_RULE, SOLO_BONUS } from './options.ts';
import type { GameState, Point, PublicGameState, Result, Seat } from './types.ts';

// The board's viewBox is 0 0 1000 640
const WIDTH = 1000;
const HEIGHT = 640;

// Null under Unlimited
export function buzzesLeft(state: GameState, seat: Seat): number | null {
  const allowed = houseRule(state, BUZZES_RULE);
  return allowed === 0 ? null : allowed - (state.buzzes[seat] ?? 0);
}

const hasBuzzes = (state: GameState, seat: Seat) => buzzesLeft(state, seat) !== 0;

export const inSlot = (state: GameState): number[] => PARTS.filter(p => state.outBy[p.id] === undefined).map(p => p.id);

const perSeat = (state: GameState) => Object.fromEntries(state.activePlayers.map(seat => [seat, 0]));

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), outBy: {}, scores: {}, buzzes: {}, live: null, lastMove: null };
}

export function resetLobby(state: GameState): GameState {
  return { ...state, outBy: {}, scores: perSeat(state), buzzes: perSeat(state), live: null, lastMove: null };
}

const isPoint = (value: unknown): value is Point =>
  Array.isArray(value) && value.length === 2 && value.every(n => typeof n === 'number' && Number.isFinite(n))
  && value[0] >= 0 && value[0] <= WIDTH && value[1] >= 0 && value[1] <= HEIGHT;

const partOf = (id: unknown) => PARTS.find(p => p.id === id);

function slotRefusal(state: GameState, id: unknown): string | null {
  if (!partOf(id)) return 'Invalid part';
  return state.outBy[id as number] === undefined ? null : 'That part is already out';
}

const voteRefusal = (state: GameState) =>
  state.undoVote ? 'An undo vote is in progress' : state.dismissVote ? 'A dismiss vote is in progress' : null;

export function applyAction(state: GameState, seat: Seat, action: unknown): Result<GameState> {
  const input = asRecord(action);
  if (state.isGameOver) return { error: 'The game is over' };
  if (state.currentPlayer !== seat) return { error: 'Not your turn' };
  // Letting go stays allowed during a vote, so a vote opened mid-drag never leaves the part held
  if (input?.type === 'drop') return { state: { ...state, live: null } };
  if (input?.type === 'pick') {
    if (!state.started && agreementPending(steadyhandInfo, state)) return { error: 'Everyone must agree to the house rules first' };
    const refusal = voteRefusal(state) ?? slotRefusal(state, input.part);
    if (refusal) return { error: refusal };
    const part = partOf(input.part)!;
    return { state: { ...state, live: { seat, part: part.id, at: part.path[0] } } };
  }
  if (input?.type === 'drag') {
    if (state.live?.seat !== seat) return { error: 'You are not holding a part' };
    const refusal = voteRefusal(state);
    if (refusal) return { error: refusal };
    if (!isPoint(input.at)) return { error: 'Invalid position' };
    return { state: { ...state, live: { ...state.live, at: [input.at[0], input.at[1]] } } };
  }
  return { error: 'Unknown action type' };
}

// The next seat after `from` in order with buzzes left, `from` itself last; null when nobody has any
function nextWithBuzzes(state: GameState, from: Seat): Seat | null {
  const seats = state.activePlayers;
  const after = seats.filter(s => s > from).concat(seats.filter(s => s <= from));
  return after.find(seat => hasBuzzes(state, seat)) ?? null;
}

const names = (state: GameState, seats: Seat[]) => seats.map(s => state.playerNames[s]).join(' and ');

// Over once the board is clear or nobody has buzzes left; a solo player who cleared it gets the bonus for buzzes left
function endIfDone(state: GameState): GameState {
  const cleared = inSlot(state).length === 0;
  if (!cleared && state.activePlayers.some(seat => hasBuzzes(state, seat))) return state;
  let scores = state.scores;
  const [solo] = state.activePlayers;
  const left = buzzesLeft(state, solo);
  if (cleared && state.activePlayers.length === 1 && left !== null) scores = { ...scores, [solo]: (scores[solo] ?? 0) + left * SOLO_BONUS };
  const best = Math.max(...state.activePlayers.map(seat => scores[seat] ?? 0));
  const winners = state.activePlayers.filter(seat => (scores[seat] ?? 0) === best);
  const points = pointsText(best);
  return {
    ...state,
    scores,
    isGameOver: true,
    currentPlayer: null,
    winners,
    gameStatus: winners.length > 1 ? `${names(state, winners)} share the win with ${points}` : `${names(state, winners)} wins with ${points}`
  };
}

export function applyMove(state: GameState, seat: Seat, move: unknown): Result<GameState> {
  const input = asRecord(move);
  if (input?.type !== 'out' && input?.type !== 'buzz') return { error: 'Unknown move type' };
  const refusal = slotRefusal(state, input.part);
  if (refusal) return { error: refusal };
  const part = partOf(input.part)!;
  const name = state.playerNames[seat];
  let next: GameState;
  if (input.type === 'out') {
    next = {
      ...state,
      outBy: { ...state.outBy, [part.id]: seat },
      scores: { ...state.scores, [seat]: (state.scores[seat] ?? 0) + part.value },
      lastMove: { type: 'out', playerNumber: seat, part: part.id, value: part.value },
      gameStatus: `${name} brought out the ${part.name} for ${pointsText(part.value)}`
    };
  } else {
    if (!isPoint(input.at)) return { error: 'Invalid position' };
    next = {
      ...state,
      buzzes: { ...state.buzzes, [seat]: (state.buzzes[seat] ?? 0) + 1 },
      lastMove: { type: 'buzz', playerNumber: seat, part: part.id, at: [input.at[0], input.at[1]] },
      gameStatus: `${name} buzzed on the ${part.name}`
    };
  }
  next = { ...next, live: null };
  return { state: endIfDone({ ...next, currentPlayer: nextWithBuzzes(next, seat) }) };
}

const letGo = (state: GameState): GameState => state.live ? { ...state, live: null } : state;

// After an approved undo or a restart the recorded state may hold the last streamed position
export const resumeClock = letGo;

export const onPlayerDisconnected = (state: GameState, seat: Seat) => state.live?.seat === seat ? letGo(state) : state;

// The platform already moved the turn on; it moves again past a seat with no buzzes left
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  if (state.isGameOver) return state;
  let next = state.live?.seat === seat ? letGo(state) : state;
  const current = next.currentPlayer;
  if (current !== null && !hasBuzzes(next, current)) next = { ...next, currentPlayer: nextWithBuzzes(next, current) };
  return endIfDone(next);
}

export const finalStandings = (state: GameState): Standing[] =>
  rankStandings(state, (a, b) => (state.scores[b] ?? 0) - (state.scores[a] ?? 0), seat => pointsText(state.scores[seat] ?? 0));

export const toPublicState = (state: GameState, undoAvailable: boolean): Omit<PublicGameState, 'moveCount'> => ({ ...state, undoAvailable });
