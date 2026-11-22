import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPlayer } from '../../shared/seating.ts';
import {
  applyAction, applyMove, createGameState, deadline, FINAL_WINDOW_MS, finalStandings, onDeadline, PLACE_WINDOW_MS, recordsAction, resetLobby
} from './rules.ts';
import { bingo } from './index.ts';
import type { Card, GameState } from './types.ts';

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

const NOW = 1_000_000;
const CALL = { type: 'call' };
const BINGO = { type: 'bingo' };
const mark = (card: number, square: number) => ({ type: 'mark', card, square });

// Column B holds 1..5 (a Line), the four corners are 1, 61, 5 and 65
const FIXED: Card = Array.from({ length: 25 }, (_, i) => (i % 5) * 15 + Math.floor(i / 5) + 1);
FIXED[12] = 0;
const LINE_SQUARES = [0, 5, 10, 15, 20];
const CORNER_SQUARES = [0, 4, 20, 24];

function lobby(count: number, rules: Record<string, string | number> = {}): GameState {
  let state = createGameState('g');
  for (let i = 1; i <= count; i++) {
    const result = addPlayer(bingo, state, `P${i}`, seeded(3));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  const houseRules = { ...state.houseRules!, values: { ...state.houseRules!.values, ...rules } };
  return resetLobby({ ...state, houseRules }, seeded(5));
}

// A game under way where every seat holds the one fixed card and `called` is already out of the pool
function game(count: number, called: number[], rules: Record<string, string | number> = {}): GameState {
  const state = lobby(count, rules);
  return {
    ...state,
    started: true,
    cards: Object.fromEntries(state.activePlayers.map(seat => [seat, [FIXED]])),
    marks: Object.fromEntries(state.activePlayers.map(seat => [seat, [[]]])),
    called,
    pool: state.pool.filter(n => !called.includes(n))
  };
}

function ok(result: { error: string } | { state: GameState }): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const markAll = (state: GameState, seat: number, squares: number[]) =>
  squares.reduce((s, square) => ok(applyAction(s, seat, mark(0, square), seeded(1), NOW)), state);

test('the dealt table follows Cards per player', () => {
  const state = lobby(3, { cards: 12 });
  for (const seat of state.activePlayers) assert.equal(state.cards[seat].length, 12);
  assert.equal(new Set(state.pool).size, 75);
  assert.equal(state.pool.length, 75);
});

test('a call draws the next number and passes the turn', () => {
  const state = game(3, []);
  const next = state.pool[0];
  const after = ok(applyMove(state, 1, CALL, seeded(1), NOW));
  assert.deepEqual(after.called, [next]);
  assert.equal(after.currentPlayer, 2);
  assert.deepEqual(after.lastMove, { type: 'call', seat: 1, number: next });
  // The same 'N 42' form as the last call shown above the cards
  assert.match(after.gameStatus, / called [BINGO] \d+$/);
});

test('forged and early marks are refused', () => {
  const state = game(3, [1, 2]);
  const forged = [mark(0, 10), mark(99, 0), mark(0, 25), mark(0, 12), mark(0, 1.5), mark(0, -1), { type: 'mark', card: '0', square: 0 }];
  for (const action of forged) assert.ok('error' in applyAction(state, 1, action, seeded(1), NOW), JSON.stringify(action));
  assert.ok('error' in applyAction(state, 9, mark(0, 0), seeded(1), NOW));
  assert.ok('error' in applyAction({ ...state, places: { 1: 1 } }, 1, mark(0, 0), seeded(1), NOW));
  assert.ok('error' in applyAction({ ...state, isGameOver: true }, 1, mark(0, 0), seeded(1), NOW));
  assert.ok('state' in applyAction(state, 1, mark(0, 0), seeded(1), NOW));
});

test('a claim needs marks', () => {
  const state = game(3, [1, 2, 3, 4, 5]);
  assert.deepEqual(applyAction(state, 1, BINGO, seeded(1), NOW), { error: 'Not a Bingo yet' });
  const claimed = ok(applyAction(markAll(state, 1, LINE_SQUARES), 1, BINGO, seeded(1), NOW));
  assert.equal(claimed.places[1], 1);
  assert.equal(claimed.openPlace?.closesAt, NOW + PLACE_WINDOW_MS);
});

test('claims inside the window share the place', () => {
  let state = game(4, [1, 2, 3, 4, 5], { playUntil: 3 });
  for (const seat of [1, 2, 3]) state = markAll(state, seat, LINE_SQUARES);
  state = ok(applyAction(state, 1, BINGO, seeded(1), NOW));
  state = ok(applyAction(state, 2, BINGO, seeded(1), NOW + 2000));
  assert.equal(state.places[2], 1);
  assert.equal(deadline(state), NOW + 3000);
  state = onDeadline(state);
  assert.equal(state.openPlace, null);
  state = ok(applyAction(state, 3, BINGO, seeded(1), NOW + 4000));
  assert.equal(state.places[3], 2);
});

test('the next call closes the place', () => {
  let state = game(4, [1, 2, 3, 4, 5], { playUntil: 3 });
  for (const seat of [1, 3]) state = markAll(state, seat, LINE_SQUARES);
  state = ok(applyAction(state, 1, BINGO, seeded(1), NOW));
  state = ok(applyMove({ ...state, currentPlayer: 2 }, 2, CALL, seeded(1), NOW + 100));
  state = ok(applyAction(state, 3, BINGO, seeded(1), NOW + 200));
  assert.equal(state.places[3], 2);
});

test('play until ends the game', () => {
  let one = game(3, [1, 2, 3, 4, 5]);
  one = ok(applyAction(markAll(one, 2, LINE_SQUARES), 2, BINGO, seeded(1), NOW));
  assert.equal(one.isGameOver, false);
  one = onDeadline(one);
  assert.equal(one.isGameOver, true);
  assert.deepEqual(one.winners, [2]);

  let three = game(3, [1, 2, 3, 4, 5], { playUntil: 3 });
  for (const seat of [1, 2, 3]) three = markAll(three, seat, LINE_SQUARES);
  three = ok(applyAction(three, 1, BINGO, seeded(1), NOW));
  three = onDeadline(three);
  assert.equal(three.isGameOver, false);
  three = ok(applyAction(three, 2, BINGO, seeded(1), NOW + 4000));
  three = onDeadline(three);
  assert.equal(three.isGameOver, false);
  three = ok(applyAction(three, 3, BINGO, seeded(1), NOW + 8000));
  assert.equal(three.isGameOver, true, 'everyone has placed');
  assert.deepEqual(three.winners, [1]);
});

test('four corners and blackout patterns are honoured', () => {
  const corners = game(2, [1, 2, 3, 4, 5, 61, 65], { pattern: 'corners' });
  assert.deepEqual(applyAction(markAll(corners, 1, LINE_SQUARES), 1, BINGO, seeded(1), NOW), { error: 'Not a Bingo yet' });
  assert.equal(ok(applyAction(markAll(corners, 1, CORNER_SQUARES), 1, BINGO, seeded(1), NOW)).places[1], 1);
  const everySquare = FIXED.flatMap((n, i) => (n ? [i] : []));
  const blackout = game(2, FIXED.filter(Boolean), { pattern: 'blackout' });
  assert.deepEqual(applyAction(markAll(blackout, 1, LINE_SQUARES), 1, BINGO, seeded(1), NOW), { error: 'Not a Bingo yet' });
  assert.equal(ok(applyAction(markAll(blackout, 1, everySquare), 1, BINGO, seeded(1), NOW)).places[1], 1);
});

test('the last call opens a final window', () => {
  let state = game(2, []);
  for (let i = 0; i < 75; i++) state = ok(applyMove({ ...state, currentPlayer: 1 }, 1, CALL, seeded(1), NOW));
  assert.equal(state.called.length, 75);
  assert.equal(deadline(state), NOW + FINAL_WINDOW_MS);
  assert.deepEqual(applyMove(state, 1, CALL, seeded(1), NOW), { error: 'No numbers left' });
  const ended = onDeadline(state);
  assert.equal(ended.isGameOver, true);
  assert.deepEqual(ended.winners, []);
});

test('recordsAction is true only for bingo', () => {
  const state = game(2, []);
  assert.equal(recordsAction(state, 1, BINGO), true);
  assert.equal(recordsAction(state, 1, mark(0, 0)), false);
  assert.equal(recordsAction(state, 1, null), false);
});

test('finalStandings ranks unplaced players last together', () => {
  const state = { ...game(4, []), places: { 3: 1, 1: 2 }, isGameOver: true, winners: [3] };
  assert.deepEqual(finalStandings(state).map(({ seat, place }) => [seat, place]), [[3, 1], [1, 2], [2, 3], [4, 3]]);
});
