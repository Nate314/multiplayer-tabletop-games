import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agreeToHouseRules, setHouseRules, type HouseRuleValues } from '../../shared/houseRules.ts';
import { SIMULATION_TICK_MS } from '../../shared/gameDefinition.ts';
import { addPlayer, removePlayer } from '../../shared/seating.ts';
import { NAMES, seeded } from '../testStates.ts';
import { fits } from './board.ts';
import { shaperace } from './index.ts';
import type { GameState, Seat } from './types.ts';

const START = 1000;

// A lobby of `seats` players with the host's house rules set, everyone agreed unless `agree` is false
function lobby(seats: number, values?: HouseRuleValues, agree = true): GameState {
  const random = seeded(3);
  let state = shaperace.createGameState('g1');
  for (const name of [...NAMES, 'Eve'].slice(0, seats)) {
    const added = addPlayer(shaperace, state, name, random);
    if ('error' in added) assert.fail(added.error);
    state = added.state;
  }
  if (values) {
    const set = setHouseRules(shaperace.info, state, 1, { values: { ...state.houseRules!.values, ...values } });
    if ('error' in set) assert.fail(set.error);
    state = shaperace.resetLobby(set.state, random);
  }
  for (const seat of agree ? state.activePlayers : []) {
    const agreed = agreeToHouseRules(shaperace.info, state, seat, state.houseRules?.revision);
    if ('error' in agreed) assert.fail(agreed.error);
    state = agreed.state;
  }
  return state;
}

const race = (seats: number, values?: HouseRuleValues) => shaperace.resumeClock!(lobby(seats, values), START);

function act(state: GameState, seat: Seat, action: unknown, now = START): GameState {
  const result = shaperace.applyAction!(state, seat, action, seeded(9), now);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function refused(state: GameState, seat: Seat, action: unknown, now = START): string {
  const before = structuredClone(state);
  const result = shaperace.applyAction!(state, seat, action, seeded(9), now);
  assert.ok('error' in result, `expected ${JSON.stringify(action)} to be refused`);
  assert.deepEqual(state, before);
  return result.error;
}

// The tray shape that belongs in `hole`, turned until it fits
function ready(state: GameState, seat: Seat, hole: number, now = START): { state: GameState; shape: number } {
  const layout = state.layout!;
  const shape = layout.tray.indexOf(layout.holes[hole]);
  let next = state;
  while (!fits(layout, next.boards[seat]!.placed, shape, hole, next.boards[seat]!.turns[shape])) next = act(next, seat, { type: 'turn', shape }, now);
  return { state: next, shape };
}

const place = (state: GameState, seat: Seat, hole: number, now = START) => {
  const { state: turned, shape } = ready(state, seat, hole, now);
  return act(turned, seat, { type: 'place', shape, hole }, now);
};

// Fills the empty holes among 0 to count - 1 of `seat`'s board, at `now`
function fill(state: GameState, seat: Seat, now = START, count: number = state.layout!.size): GameState {
  let next = state;
  for (let hole = 0; hole < count; hole++) if (next.boards[seat]!.placed[hole] === undefined) next = place(next, seat, hole, now);
  return next;
}

const rows = (state: GameState) => shaperace.finalStandings!(state).map(({ seat, place, score }) => [seat, place, score]);

test('every seat gets the same layout', () => {
  const state = lobby(3);
  assert.equal(state.layout!.size, 16);
  for (const seat of [1, 2, 3]) assert.deepEqual(state.boards[seat], { placed: {}, turns: state.layout!.startTurns });
});

test('house rules choose the board size and the timer', () => {
  const state = race(2, { shapes: 9, seconds: 30 });
  assert.equal(state.layout!.size, 9);
  assert.equal(shaperace.deadline!(state), START + 30_000);
});

test('resumeClock starts the race only once everyone agreed', () => {
  const waiting = shaperace.resumeClock!(lobby(2, undefined, false), START);
  assert.equal(waiting.raceStartedAt, null);
  assert.equal(shaperace.deadline!(waiting), null);
  assert.equal(refused(waiting, 1, { type: 'turn', shape: 0 }), 'Wait for everyone to agree to the house rules');
  const running = race(2);
  assert.equal(running.raceStartedAt, START);
  assert.equal(running.started, true);
  assert.equal(shaperace.deadline!(running), START + 60_000);
  const over = shaperace.onDeadline!(running, START + 60_000, seeded(1));
  assert.equal(shaperace.resumeClock!(over, 99_999), over);
  assert.equal(shaperace.deadline!(over), null);
  // A paused race keeps its start until the resume, which moves it on by the paused time
  const paused = { ...running, paused: true, pausedAt: START + 20_000 };
  assert.equal(shaperace.resumeClock!(paused, START + 50_000), paused);
  assert.equal(shaperace.resumeClock!({ ...paused, paused: false }, START + 50_000).raceStartedAt, START + 30_000);
});

test('turn changes only the sender\'s shape', () => {
  const state = race(2);
  const turned = act(state, 1, { type: 'turn', shape: 0 });
  assert.equal(turned.boards[1]!.turns[0], (state.boards[1]!.turns[0] + 1) % 8);
  assert.equal(turned.boards[2]!.turns[0], state.boards[2]!.turns[0]);
  assert.equal(shaperace.recordsAction!(state, 1, { type: 'turn', shape: 0 }), false);
});

test('a fitting placement is recorded and a wrong one is refused', () => {
  const { state, shape } = ready(race(2), 1, 0);
  assert.equal(shaperace.recordsAction!(state, 1, { type: 'place', shape, hole: 0 }), true);
  const placed = act(state, 1, { type: 'place', shape, hole: 0 });
  assert.equal(placed.boards[1]!.placed[0], shape);
  assert.deepEqual(placed.lastMove, { playerNumber: 1, shape, hole: 0 });
  assert.equal(refused(state, 1, { type: 'place', shape, hole: 1 }), 'That shape does not fit there');
  assert.equal(shaperace.recordsAction!(state, 1, { type: 'place', shape, hole: 1 }), false);
});

test('untrusted actions are refused, never thrown', () => {
  const state = race(2);
  for (const action of [null, 5, {}, { type: 'jump' }, { type: 'turn' }, { type: 'turn', shape: 1.5 }, { type: 'turn', shape: -1 }, { type: 'turn', shape: 16 },
    { type: 'turn', shape: '0' }, { type: 'place', shape: 0 }, { type: 'place', shape: 0, hole: 16 }, { type: 'place', shape: 99, hole: 0 }, { type: 'place', shape: 0, hole: NaN }]) {
    refused(state, 1, action);
    assert.equal(shaperace.recordsAction!(state, 1, action), false);
  }
  assert.equal(refused(state, 9, { type: 'turn', shape: 0 }), 'You are not racing');
  const before = shaperace.createGameState('g1');
  refused(before, 1, { type: 'place', shape: 0, hole: 0 });
  const over = shaperace.onDeadline!(state, START + 60_000, seeded(1));
  assert.equal(refused(over, 1, { type: 'turn', shape: 0 }), 'The race is over');
  assert.deepEqual(shaperace.applyMove(state, 1, {}, seeded(1), START), { error: 'Drag the shapes onto the board' });
  assert.equal(shaperace.allowsUndoVote!(state), false);
});

test('a placement after the deadline is refused', () => {
  const { state, shape } = ready(race(2), 1, 0);
  const deadline = shaperace.deadline!(state)!;
  assert.equal(refused(state, 1, { type: 'place', shape, hole: 0 }, deadline), 'Time is up');
  act(state, 1, { type: 'place', shape, hole: 0 }, deadline - 1);
});

test('keep racing ranks finishers by time', () => {
  let state = place(place(place(place(race(3), 3, 0), 3, 1), 3, 2), 3, 3);
  state = fill(state, 2, START + 5000);
  state = fill(state, 1, START + 7000);
  assert.equal(state.isGameOver, false);
  assert.deepEqual(state.finishTimes, { 2: 5000, 1: 7000 });
  assert.equal(refused(state, 2, { type: 'turn', shape: 0 }), 'You have finished');

  const filled = fill(state, 3, START + 9000);
  assert.equal(filled.isGameOver, true);
  assert.deepEqual(filled.winners, [2]);
  assert.deepEqual(rows(filled), [[2, 1, '0:05.0'], [1, 2, '0:07.0'], [3, 3, '0:09.0']]);

  const popped = shaperace.onDeadline!(state, START + 60_000, seeded(1));
  assert.equal(popped.isGameOver, true);
  assert.deepEqual(popped.winners, [2]);
  assert.deepEqual(rows(popped), [[2, 1, '0:05.0'], [1, 2, '0:07.0'], [3, 3, '4/16']]);
});

test('finishes in the same tick share the place', () => {
  const [a, b] = [5010, 5040];
  assert.equal(Math.floor(a / SIMULATION_TICK_MS), Math.floor(b / SIMULATION_TICK_MS));
  const state = fill(fill(race(2), 1, START + a), 2, START + b);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1, 2]);
  assert.deepEqual(rows(state), [[1, 1, '0:05.0'], [2, 1, '0:05.0']]);
});

test('first finish ends the race at once', () => {
  let state = race(3, { raceEnd: 'first' });
  state = fill(fill(state, 1, START, 2), 2, START, 2);
  state = fill(state, 3, START + 42_345);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [3]);
  assert.deepEqual(rows(state), [[3, 1, '0:42.3'], [1, 2, '2/16'], [2, 2, '2/16']]);
});

test('race end is offered only with two or more seats', () => {
  assert.equal('raceEnd' in lobby(1).houseRules!.values, false);
  assert.equal(lobby(2).houseRules!.values.raceEnd, 'keep');
});

test('the pop ends the race', () => {
  const state = fill(fill(fill(race(3), 1, START, 3), 2, START, 3), 3, START, 1);
  const popped = shaperace.onDeadline!(state, START + 60_000, seeded(1));
  assert.equal(popped.isGameOver, true);
  assert.equal(popped.popped, true);
  assert.deepEqual(popped.winners, [1, 2]);
  assert.deepEqual(rows(popped), [[1, 1, '3/16'], [2, 1, '3/16'], [3, 2, '1/16']]);
  assert.equal(popped.gameStatus, 'The board popped! Alice and Bob placed the most');

  const tied = shaperace.onDeadline!(fill(fill(fill(race(3), 1, START, 1), 2, START, 1), 3, START, 1), START + 60_000, seeded(1));
  assert.equal(tied.gameStatus, 'The board popped! Alice, Bob and Cara placed the most');
  const empty = shaperace.onDeadline!(race(3), START + 60_000, seeded(1));
  assert.deepEqual(empty.winners, [1, 2, 3]);
  assert.equal(empty.gameStatus, 'The board popped! Nobody placed a shape');

  const finished = fill(fill(race(3), 1, START + 2000), 2, START, 3);
  assert.deepEqual(shaperace.onDeadline!(finished, START + 60_000, seeded(1)).winners, [1]);
});

test('solo wins only by filling the board', () => {
  const state = race(1);
  const popped = shaperace.onDeadline!(fill(state, 1, START, 15), START + 60_000, seeded(1));
  assert.deepEqual(popped.winners, []);
  assert.deepEqual(rows(popped), [[1, 1, '15/16']]);
  const filled = fill(state, 1, START + 30_000);
  assert.equal(filled.isGameOver, true);
  assert.deepEqual(filled.winners, [1]);
  assert.deepEqual(rows(filled), [[1, 1, '0:30.0']]);
});

test('leaving ends the race when everyone left has finished', () => {
  const state = fill(fill(place(race(3), 3, 0), 1, START + 3000), 2, START + 4000);
  assert.equal(state.isGameOver, false);
  const left = removePlayer(shaperace, state, 3, seeded(5));
  assert.equal(left.isGameOver, true);
  assert.deepEqual(left.winners, [1]);
  assert.equal(3 in left.boards, false);

  const stillRacing = removePlayer(shaperace, fill(race(3), 1, START + 3000), 2, seeded(5));
  assert.equal(stillRacing.isGameOver, false);
});

test("another racer's placement shows only who placed until the race is over", () => {
  const state = place(race(2), 1, 0);
  const placed = state.lastMove!;
  assert.deepEqual(shaperace.toPublicState(state, false, 2).lastMove, { playerNumber: 1 });
  assert.deepEqual(shaperace.toPublicState(state, false, null).lastMove, { playerNumber: 1 });
  assert.deepEqual(shaperace.toPublicState(state, false, 1).lastMove, placed);
  assert.deepEqual(shaperace.spectatorState!(state, false, false).lastMove, placed);
  const over = shaperace.onDeadline!(state, START + 60_000, seeded(1));
  assert.deepEqual(shaperace.toPublicState(over, false, 2).lastMove, placed);
});

test('others see counts, not boards, during the race', () => {
  const state = place(race(3), 2, 0);
  const view = shaperace.toPublicState(state, false, 1);
  assert.deepEqual(Object.keys(view.boards), ['1']);
  assert.deepEqual(view.placedCounts, { 1: 0, 2: 1, 3: 0 });
  assert.equal(view.endsAt, START + 60_000);
  assert.deepEqual(Object.keys(shaperace.toPublicState(state, false, null).boards), []);
  assert.deepEqual(shaperace.spectatorState!(state, false, false).boards, state.boards);
  assert.deepEqual(shaperace.spectatorState!(state, false, true).boards, {});
  assert.deepEqual(shaperace.privateSeatView!(state, 2), { boards: { 2: state.boards[2] } });
  const over = shaperace.onDeadline!(state, START + 60_000, seeded(1));
  assert.deepEqual(shaperace.toPublicState(over, false, 1).boards, over.boards);
  assert.equal(shaperace.toPublicState(over, false, 1).endsAt, null);
});
