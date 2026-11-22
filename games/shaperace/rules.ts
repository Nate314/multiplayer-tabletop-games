// Shape Race rules: every seat races the same layout on its own board against one server clock
import { SIMULATION_TICK_MS } from '../../shared/gameDefinition.ts';
import { everyoneAgreed, houseRule } from '../../shared/houseRules.ts';
import { asRecord } from '../../shared/messages.ts';
import { visibleBoards } from '../../shared/puzzleModes.ts';
import { baseGameState } from '../../shared/seating.ts';
import { seatFields } from '../../shared/spectators.ts';
import { rankStandings } from '../../shared/standings.ts';
import { listOf } from '../../shared/text.ts';
import type { Random, Standing } from '../../shared/types.ts';
import { dealLayout, fits, turnOnce } from './board.ts';
import { shaperaceInfo } from './info.ts';
import { END_RULE, SIZE_RULE, TIMER_RULE } from './options.ts';
import type { GameState, PublicGameState, Result, Seat, SeatBoard } from './types.ts';

export function createGameState(gameId: string): GameState {
  return { ...baseGameState(gameId), layout: null, boards: {}, raceStartedAt: null, finishTimes: {}, popped: false, lastMove: null };
}

// Before the start, after anyone joins or leaves: one new layout, the same for every seat
export function resetLobby(state: GameState, random: Random): GameState {
  const layout = dealLayout(houseRule(state, SIZE_RULE), random);
  return {
    ...state,
    layout,
    boards: Object.fromEntries(state.activePlayers.map(seat => [seat, { placed: {}, turns: layout.startTurns }])),
    raceStartedAt: null,
    finishTimes: {},
    popped: false,
    lastMove: null,
    currentPlayer: null // no turns: everyone races at once
  };
}

const placedCount = (board: SeatBoard | undefined) => board ? Object.keys(board.placed).length : 0;
// Finishes the server receives in the same tick share the place
const tick = (ms: number) => Math.floor(ms / SIMULATION_TICK_MS);
const names = (state: GameState, seats: Seat[]) => listOf(seats.map(seat => state.playerNames[seat]));

export const deadline = (state: GameState): number | null =>
  state.raceStartedAt === null || state.isGameOver ? null : state.raceStartedAt + houseRule(state, TIMER_RULE) * 1000;

// Winners: the earliest finishers, else (with company) the most shapes placed; a solo player wins only by filling the board
function end(state: GameState, popped: boolean): GameState {
  const finishers = state.activePlayers.filter(seat => state.finishTimes[seat] !== undefined);
  const best = Math.min(...finishers.map(seat => tick(state.finishTimes[seat]!)));
  const most = Math.max(...state.activePlayers.map(seat => placedCount(state.boards[seat])));
  const winners = finishers.length > 0 ? finishers.filter(seat => tick(state.finishTimes[seat]!) === best)
    : state.activePlayers.length === 1 ? []
      : state.activePlayers.filter(seat => placedCount(state.boards[seat]) === most);
  const gameStatus = finishers.length > 0 ? `${names(state, winners)} finished first!`
    : most === 0 ? 'The board popped! Nobody placed a shape'
      : winners.length > 0 ? `The board popped! ${names(state, winners)} placed the most` : 'The board popped!';
  return { ...state, isGameOver: true, currentPlayer: null, winners, popped, gameStatus };
}

// The race ends on the first finish with First finish, else once everyone still racing has finished
function settle(state: GameState): GameState {
  const finished = state.activePlayers.filter(seat => state.finishTimes[seat] !== undefined).length;
  if (finished === 0) return state;
  return houseRule(state, END_RULE) === 'first' || finished === state.activePlayers.length ? end(state, false) : state;
}

const indexBelow = (value: unknown, size: number): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < size ? value : null;

export function applyAction(state: GameState, seat: Seat, action: unknown, _random: Random, now: number): Result<GameState> {
  const { layout, raceStartedAt } = state;
  if (raceStartedAt === null || !layout) return { error: 'Wait for everyone to agree to the house rules' };
  if (state.isGameOver) return { error: 'The race is over' };
  const board = state.boards[seat];
  if (!board) return { error: 'You are not racing' };
  if (state.finishTimes[seat] !== undefined) return { error: 'You have finished' };
  if (now >= deadline(state)!) return { error: 'Time is up' };
  const input = asRecord(action);
  if (input?.type !== 'turn' && input?.type !== 'place') return { error: 'Unknown action' };
  const shape = indexBelow(input.shape, layout.size);
  if (shape === null) return { error: 'No such shape' };
  const withBoard = (next: SeatBoard): GameState => ({ ...state, boards: { ...state.boards, [seat]: next } });

  if (input.type === 'turn') {
    if (Object.values(board.placed).includes(shape)) return { error: 'That shape is in place' };
    return { state: withBoard({ ...board, turns: board.turns.map((turns, i) => i === shape ? turnOnce(turns) : turns) }) };
  }
  const hole = indexBelow(input.hole, layout.size);
  if (hole === null) return { error: 'No such hole' };
  if (!fits(layout, board.placed, shape, hole, board.turns[shape])) return { error: 'That shape does not fit there' };
  const placed = { ...withBoard({ ...board, placed: { ...board.placed, [hole]: shape } }), lastMove: { playerNumber: seat, shape, hole } };
  if (placedCount(placed.boards[seat]) < layout.size) return { state: placed };
  return {
    state: settle({
      ...placed,
      finishTimes: { ...state.finishTimes, [seat]: now - raceStartedAt },
      gameStatus: `${state.playerNames[seat]} filled their board`
    })
  };
}

// Only a placement is a step on the timeline. applyAction refuses a late one, so the time passed here does not matter
export function recordsAction(state: GameState, seat: Seat, action: unknown): boolean {
  return asRecord(action)?.type === 'place' && 'state' in applyAction(state, seat, action, Math.random, state.raceStartedAt ?? 0);
}

export function applyMove(): Result<GameState> {
  return { error: 'Drag the shapes onto the board' };
}

export const onDeadline = (state: GameState): GameState => state.isGameOver || state.raceStartedAt === null ? state : end(state, true);

// The clock starts on the last agreement; `started` stops a join or a leave from dealing a new layout mid-race
// shortcut: a server restart gives the race its full time again, store elapsed time if that ever matters
export function resumeClock(state: GameState, now: number): GameState {
  // While paused the clock is stopped; resuming moves the start on by the paused time, so the race keeps the time it had left
  if (state.isGameOver || state.paused || !(state.started || everyoneAgreed(shaperaceInfo, state))) return state;
  if (state.raceStartedAt !== null && state.pausedAt !== undefined) return { ...state, raceStartedAt: state.raceStartedAt + now - state.pausedAt };
  return { ...state, started: true, raceStartedAt: now };
}

export const allowsUndoVote = (): false => false;

// The leaver's board goes with them; the race ends if everyone left has finished
export function onPlayerLeft(state: GameState, seat: Seat): GameState {
  const { [seat]: _board, ...boards } = state.boards;
  const { [seat]: _time, ...finishTimes } = state.finishTimes;
  return settle({ ...state, boards, finishTimes });
}

// m:ss.t, e.g. 0:42.3
export function clock(ms: number): string {
  const tenths = Math.floor(ms / 100);
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`;
}

// Finishers first by tick, then the rest by shapes placed
export function finalStandings(state: GameState): Standing[] {
  const time = (seat: Seat) => state.finishTimes[seat];
  const count = (seat: Seat) => placedCount(state.boards[seat]);
  const compare = (a: Seat, b: Seat) => {
    const [ta, tb] = [time(a), time(b)];
    if (ta !== undefined && tb !== undefined) return tick(ta) - tick(tb);
    if (ta !== undefined || tb !== undefined) return ta === undefined ? 1 : -1;
    return count(b) - count(a);
  };
  return rankStandings(state, compare, seat => time(seat) !== undefined ? clock(time(seat)!) : `${count(seat)}/${state.layout?.size ?? 0}`);
}

function view(state: GameState, undoAvailable: boolean, boards: GameState['boards']): Omit<PublicGameState, 'moveCount'> {
  const placedCounts = Object.fromEntries(Object.entries(state.boards).map(([seat, board]) => [seat, placedCount(board)]));
  return { ...state, undoAvailable, boards, placedCounts, endsAt: deadline(state) };
}

// During the race a seat sees only its own board, and the others' counts
// Another racer's placement keeps only who placed, so its shape and hole cannot rebuild their board
export function toPublicState(state: GameState, undoAvailable: boolean, viewer: Seat | null) {
  const { lastMove, isGameOver } = state;
  const hidden = lastMove && !isGameOver && lastMove.playerNumber !== viewer ? { playerNumber: lastMove.playerNumber } : lastMove;
  return view({ ...state, lastMove: hidden }, undoAvailable, visibleBoards(state.boards, viewer, isGameOver));
}

// An ordinary spectator sees every board; a table screen sits in front of the racers and gets the null view
export const spectatorState = (state: GameState, undoAvailable: boolean, tableScreen: boolean) =>
  tableScreen ? toPublicState(state, undoAvailable, null) : view(state, undoAvailable, state.boards);

export const privateSeatView = (state: GameState, seat: Seat): Pick<PublicGameState, 'boards'> =>
  seatFields(toPublicState(state, false, seat), ['boards']);
