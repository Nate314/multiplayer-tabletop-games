import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeLastMove, finalStandings } from './rules.ts';
import { snakesladders } from './index.ts';
import { addPlayer, removePlayer } from '../../shared/seating.ts';
import { withRules } from '../../server/testing.ts';
import type { GameState, LastMove, Random, Result, Seat } from './types.ts';

const NAMES = ['Alice', 'Bob', 'Cara'];

// A random that rolls the given die faces in turn, then 1s
function faces(...values: number[]): Random {
  let index = 0;
  return () => ((values[index++] ?? 1) - 0.5) / 6;
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function lobby(count: number): GameState {
  let state = snakesladders.createGameState('g1');
  for (const name of NAMES.slice(0, count)) {
    const result = addPlayer(snakesladders, state, name, faces());
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

// A game in progress with the tokens on the given squares
function at(positions: Record<Seat, number>, { exactFinish = false } = {}): GameState {
  const state = lobby(Object.keys(positions).length);
  return {
    ...state,
    started: true,
    currentPlayer: 1,
    positions,
    houseRules: exactFinish ? withRules({ exactFinish: true }) : state.houseRules
  };
}

function roll(state: GameState, seat: Seat, face: number): GameState {
  return ok(snakesladders.applyMove(state, seat, { type: 'roll' }, faces(face), 0));
}

test('every token starts on square 1 and seat 1 rolls first', () => {
  const state = lobby(3);
  assert.deepEqual(state.positions, { 1: 1, 2: 1, 3: 1 });
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.lastMove, null);
});

test('a roll moves the token that many squares and passes the turn', () => {
  const next = roll(at({ 1: 1, 2: 1 }), 1, 4);
  assert.equal(next.positions[1], 5);
  assert.equal(next.currentPlayer, 2);
  assert.equal(next.gameStatus, 'Alice rolled 4 and moved from 1 to 5');
});

test('landing on a ladder foot climbs it', () => {
  const next = roll(at({ 1: 1, 2: 1 }), 1, 2);
  assert.equal(next.positions[1], 22);
  assert.equal(next.lastMove?.via, 'ladder');
  assert.equal(next.lastMove?.landed, 3);
});

test('landing on a snake head slides down', () => {
  const next = roll(at({ 1: 24, 2: 1 }), 1, 3);
  assert.equal(next.positions[1], 5);
  assert.equal(next.lastMove?.via, 'snake');
});

test('a 6 rolls again', () => {
  const first = roll(at({ 1: 1, 2: 1 }), 1, 6);
  assert.equal(first.positions[1], 7);
  assert.equal(first.currentPlayer, 1);
  assert.equal(first.lastMove?.again, true);
  assert.ok(first.gameStatus.endsWith(', and rolls again'));
  const second = roll(first, 1, 6);
  assert.equal(second.positions[1], 13);
  assert.equal(second.currentPlayer, 1);
  assert.equal(second.lastMove?.again, true);
  const third = roll(second, 1, 2);
  assert.equal(third.positions[1], 15);
  assert.equal(third.currentPlayer, 2);
  assert.equal(third.lastMove?.again, false);
});

test('without exact finish, passing 100 stops on 100 and wins', () => {
  const next = roll(at({ 1: 97, 2: 1 }), 1, 5);
  assert.equal(next.positions[1], 100);
  assert.equal(next.isGameOver, true);
  assert.deepEqual(next.winners, [1]);
  assert.equal(next.currentPlayer, null);
  assert.equal(next.gameStatus, 'Alice wins!');
});

test('exact finish: too high a roll stays put, and a 6 still rolls again', () => {
  const short = roll(at({ 1: 97, 2: 1 }, { exactFinish: true }), 1, 5);
  assert.equal(short.positions[1], 97);
  assert.equal(short.lastMove?.stayed, true);
  assert.equal(short.gameStatus, 'Alice rolled 5 and needs exactly 3 to reach 100');
  assert.equal(short.currentPlayer, 2);

  const six = roll(at({ 1: 95, 2: 1 }, { exactFinish: true }), 1, 6);
  assert.equal(six.positions[1], 95);
  assert.equal(six.lastMove?.stayed, true);
  assert.equal(six.currentPlayer, 1);

  const exact = roll(at({ 1: 97, 2: 1 }, { exactFinish: true }), 1, 3);
  assert.equal(exact.positions[1], 100);
  assert.equal(exact.isGameOver, true);
  assert.deepEqual(exact.winners, [1]);
});

test('a 6 that reaches 100 wins and does not roll again', () => {
  const next = roll(at({ 1: 94, 2: 1 }), 1, 6);
  assert.equal(next.isGameOver, true);
  assert.deepEqual(next.winners, [1]);
  assert.equal(next.lastMove?.again, false);
  assert.equal(next.currentPlayer, null);
});

test('tokens may share a square', () => {
  const next = roll(at({ 1: 1, 2: 5 }), 1, 4);
  assert.deepEqual(next.positions, { 1: 5, 2: 5 });
});

test('the roller leaving after a 6 passes the turn on and removes their token', () => {
  const rolled = roll(at({ 1: 1, 2: 1, 3: 1 }), 1, 6);
  assert.equal(rolled.currentPlayer, 1);
  const left = removePlayer(snakesladders, rolled, 1, faces());
  assert.deepEqual(left.positions, { 2: 1, 3: 1 });
  assert.equal(left.currentPlayer, 2);
});

test('malformed moves are rejected', () => {
  const state = at({ 1: 1, 2: 1 });
  for (const move of [null, { type: 'move' }, 'roll']) {
    assert.deepEqual(snakesladders.applyMove(state, 1, move, faces(4), 0), { error: 'Unknown move type' });
  }
});

test('finalStandings ranks by square, the winner first', () => {
  const state = { ...at({ 1: 100, 2: 40, 3: 57 }), isGameOver: true, winners: [1] };
  assert.deepEqual(finalStandings(state), [
    { seat: 1, place: 1, score: 'Reached 100' },
    { seat: 3, place: 2, score: 'Square 57' },
    { seat: 2, place: 3, score: 'Square 40' }
  ]);
});

test('describeLastMove covers every kind of roll', () => {
  const names: Record<Seat, string> = { 1: 'Alice', 2: 'Bob' };
  const move = (fields: Partial<LastMove>): LastMove => ({
    type: 'roll', playerNumber: 1, roll: 4, from: 3, landed: 7, to: 7, via: null, stayed: false, again: false, ...fields
  });
  assert.equal(describeLastMove(move({}), names), 'Alice rolled 4 and moved from 3 to 7');
  assert.equal(describeLastMove(move({ roll: 2, from: 1, landed: 3, to: 22, via: 'ladder' }), names),
    'Alice rolled 2 and climbed a ladder from 3 to 22');
  assert.equal(describeLastMove(move({ playerNumber: 2, roll: 3, from: 24, landed: 27, to: 5, via: 'snake' }), names),
    'Bob rolled 3 and slid down a snake from 27 to 5');
  assert.equal(describeLastMove(move({ roll: 5, from: 97, landed: 97, to: 97, stayed: true }), names),
    'Alice rolled 5 and needs exactly 3 to reach 100');
  assert.equal(describeLastMove(move({ roll: 3, from: 97, landed: 100, to: 100 }), names), 'Alice rolled 3 and reached 100');
  assert.equal(describeLastMove(move({ roll: 6, again: true }), names), 'Alice rolled 6 and moved from 3 to 7, and rolls again');
  assert.equal(describeLastMove(move({ roll: 6, from: 2, landed: 8, to: 30, via: 'ladder', again: true }), names),
    'Alice rolled 6 and climbed a ladder from 8 to 30, and rolls again');
  assert.equal(describeLastMove(move({ roll: 6, from: 92, landed: 98, to: 61, via: 'snake', again: true }), names),
    'Alice rolled 6 and slid down a snake from 98 to 61, and rolls again');
  assert.equal(describeLastMove(move({ roll: 6, from: 95, landed: 95, to: 95, stayed: true, again: true }), names),
    'Alice rolled 6 and needs exactly 5 to reach 100, and rolls again');
});
