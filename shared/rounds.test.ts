import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acknowledge, everyoneReady } from './rounds.ts';
import type { Acknowledgeable, RoundAccess } from './rounds.ts';
import { baseGameState } from './seating.ts';
import type { BaseGameState, Result, Seat } from './types.ts';

type Summary = Acknowledgeable & { points: number };
type State = BaseGameState & { summary: Summary | null; dealt: number };

const round: RoundAccess<State, Summary> = {
  get: state => state.summary,
  set: (state, summary) => ({ ...state, summary }),
  noun: 'hand'
};

// Deals the next round: the summary goes and the deal count rises
const deal = (state: State): State => ({ ...state, summary: null, dealt: state.dealt + 1, gameStatus: 'Dealt' });

// Three players between hands, nobody ready yet
function between(overrides: Partial<State> = {}): State {
  return {
    ...baseGameState('g1'),
    started: true,
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    summary: { points: 5, acknowledged: [] },
    dealt: 1,
    ...overrides
  };
}

function ok(result: Result<State>): State {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

test('nothing to continue without a summary', () => {
  const state = between({ summary: null });
  assert.deepEqual(acknowledge(state, 1, round, deal), { error: 'Nothing to continue' });
  assert.equal(everyoneReady(state, round), false);
});

test('acknowledging twice changes nothing', () => {
  const once = ok(acknowledge(between(), 1, round, deal));
  assert.equal(ok(acknowledge(once, 1, round, deal)), once);
});

test('the status names the ready player', () => {
  const state = ok(acknowledge(between(), 1, round, deal));
  assert.equal(state.gameStatus, 'Alice is ready for the next hand');
  assert.deepEqual(state.summary, { points: 5, acknowledged: [1] });
  assert.equal(state.dealt, 1);
});

test('the next round starts once every connected player is ready', () => {
  let state = between({ disconnected: [3] });
  state = ok(acknowledge(state, 1, round, deal));
  assert.equal(everyoneReady(state, round), false);
  state = ok(acknowledge(state, 2, round, deal)); // Cara is disconnected, so nobody waits for her
  assert.equal(state.dealt, 2);
  assert.equal(state.summary, null);
  assert.equal(state.gameStatus, 'Dealt');
});

test('a player leaving while the others wait leaves everyone ready', () => {
  const waiting = ok(acknowledge(ok(acknowledge(between(), 1, round, deal)), 2, round, deal));
  assert.equal(everyoneReady(waiting, round), false);
  assert.equal(everyoneReady({ ...waiting, activePlayers: [1, 2] }, round), true);
  assert.equal(everyoneReady({ ...waiting, disconnected: [3] }, round), true);
});

test('nobody is ready once the game is over', () => {
  const over = between({ isGameOver: true, summary: { points: 5, acknowledged: [1, 2, 3] } });
  assert.equal(everyoneReady(over, round), false);
  const acknowledged = ok(acknowledge(between({ isGameOver: true }), 1, round, deal));
  assert.equal(acknowledged.dealt, 1);
});

test('waitsFor narrows who must be ready', () => {
  const chips: Record<Seat, number> = { 1: 100, 2: 0, 3: 50 };
  const holders: RoundAccess<State, Summary> = { ...round, waitsFor: state => state.activePlayers.filter(seat => chips[seat] > 0) };
  let state = ok(acknowledge(between(), 1, holders, deal));
  state = ok(acknowledge(state, 3, holders, deal));
  assert.equal(state.dealt, 2);
});

test("a state shaped like today's Hearts state continues", () => {
  type HeartsSummary = Acknowledgeable & { handNumber: number; taken: Record<Seat, number>; change: Record<Seat, number>; moon: Seat | null };
  type HeartsState = BaseGameState & { roundSummary: HeartsSummary | null; handNumber: number };
  const hearts: RoundAccess<HeartsState, HeartsSummary> = {
    get: state => state.roundSummary,
    set: (state, roundSummary) => ({ ...state, roundSummary }),
    noun: 'hand'
  };
  const saved: HeartsState = {
    ...baseGameState('g1'),
    started: true,
    activePlayers: [1, 2, 3, 4],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' },
    gameStatus: 'Bob took the last trick',
    handNumber: 1,
    roundSummary: { handNumber: 1, taken: { 1: 0, 2: 0, 3: 0, 4: 26 }, change: { 1: 0, 2: 0, 3: 0, 4: 26 }, moon: null, acknowledged: [1, 2, 3] }
  };
  const next = (state: HeartsState): HeartsState => ({ ...state, roundSummary: null, handNumber: state.handNumber + 1 });
  const result = acknowledge(saved, 4, hearts, next);
  assert.ok('state' in result);
  assert.equal(result.state.handNumber, 2);
  assert.equal(result.state.roundSummary, null);
});
