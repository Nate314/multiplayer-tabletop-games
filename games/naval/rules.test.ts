import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, shotsAllowed, toPublicState, waitingOn } from './rules.ts';
import { naval } from './index.ts';
import { withRules } from '../../server/testing.ts';
import { addPlayer, applyMove } from '../../shared/seating.ts';
import type { HouseRuleValues } from '../../shared/houseRules.ts';
import type { Cell, GameState, Seat, Ship, Shot } from './types.ts';

const across = (length: Ship['length'], row: number, col: number): Ship => ({ length, row, col, orientation: 'across' });

// Alice's fleet fills the top left; Bob's lies lower down, with his 2 at J9-J10
const A: Ship[] = [across(5, 0, 0), across(4, 1, 0), across(3, 2, 0), across(3, 3, 0), across(2, 4, 0)];
const B: Ship[] = [across(5, 5, 0), across(4, 6, 0), across(3, 7, 0), across(3, 8, 0), across(2, 9, 8)];

const cell = (row: number, col: number): Cell => ({ row, col });

function lobby(houseRules?: HouseRuleValues, names = ['Alice', 'Bob']): GameState {
  let state: GameState = houseRules ? { ...naval.createGameState('g1'), houseRules: withRules(houseRules) } : naval.createGameState('g1');
  for (const name of names) {
    const result = addPlayer(naval, state, name);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

function place(state: GameState, seat: Seat, ships: unknown): GameState {
  const result = applyAction(state, seat, { type: 'place', ships });
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function playing(houseRules?: HouseRuleValues): GameState {
  return place(place(lobby(houseRules), 1, A), 2, B);
}

function fire(state: GameState, seat: Seat, ...targets: Cell[]): GameState {
  const result = applyMove(naval, state, seat, { type: 'fire', targets });
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function refusal(state: GameState, seat: Seat, ...targets: Cell[]): string {
  const result = applyMove(naval, state, seat, { type: 'fire', targets });
  assert.ok('error' in result, 'expected a refusal');
  return result.error;
}

// Squares in columns 10 down to 6, rows A to E: no ship of either fleet stands there
const empty = (n: number) => cell(n % 5, 9 - Math.floor(n / 5));

test('placing both fleets starts play with seat 1 to fire', () => {
  const alice = place(lobby(), 1, A);
  assert.equal(alice.started, true);
  assert.equal(alice.phase, 'placing');
  assert.equal(alice.gameStatus, 'Alice is ready');
  const both = place(alice, 2, B);
  assert.equal(both.phase, 'firing');
  assert.equal(both.currentPlayer, 1);
  assert.equal(both.gameStatus, 'Both fleets are ready. Alice fires first');
});

test('a fleet cannot be placed twice, alone, or wrong', () => {
  const alice = place(lobby(), 1, A);
  const again = applyAction(alice, 1, { type: 'place', ships: A });
  assert.deepEqual(again, { error: 'Your fleet is already placed' });
  const alone = applyAction(lobby(undefined, ['Alice']), 1, { type: 'place', ships: A });
  assert.deepEqual(alone, { error: 'Waiting for another player' });
  const wrong = applyAction(lobby(), 1, { type: 'place', ships: A.slice(1) });
  assert.deepEqual(wrong, { error: 'Place one ship of each length: 5, 4, 3, 3 and 2' });
  const overlap = applyAction(lobby(), 1, { type: 'place', ships: [...A.slice(0, 4), across(2, 3, 0)] });
  assert.deepEqual(overlap, { error: 'Ships cannot overlap' });
});

test('firing reports miss, hit and sunk with the length', () => {
  let state = playing();
  state = fire(state, 1, cell(0, 0));
  assert.deepEqual(state.shots[1], [{ row: 0, col: 0, result: 'miss' }]);
  assert.equal(state.gameStatus, 'Alice fired at A1: miss');
  state = fire(state, 2, cell(0, 0));
  assert.equal(state.shots[2][0].result, 'hit');
  state = fire(state, 1, cell(9, 8));
  assert.deepEqual(state.shots[1][1], { row: 9, col: 8, result: 'hit' });
  state = fire(state, 2, cell(8, 9));
  state = fire(state, 1, cell(9, 9));
  assert.deepEqual(state.shots[1][2], { row: 9, col: 9, result: 'sunk', sunkLength: 2 });
  assert.equal(state.gameStatus, 'Alice fired at J10: sank a ship of length 2');
});

test('a hit gives no extra shot', () => {
  const state = fire(playing(), 1, cell(5, 0));
  assert.equal(state.shots[1][0].result, 'hit');
  assert.equal(state.currentPlayer, 2);
});

test('firing is refused before both fleets, off the grid, twice at one square, or with the wrong count', () => {
  const waiting = applyMove(naval, place(lobby(), 1, A), 1, { type: 'fire', targets: [cell(0, 0)] });
  assert.deepEqual(waiting, { error: 'Wait for both fleets to be placed' });
  const state = playing();
  assert.equal(refusal(state, 1, cell(10, 0)), 'That square is off the grid');
  assert.equal(refusal(state, 1, cell(0, -1)), 'That square is off the grid');
  assert.equal(refusal(state, 1, { row: 0.5, col: 1 }), 'That square is off the grid');
  assert.equal(refusal(state, 1), 'Fire at 1 square');
  assert.equal(refusal(state, 1, cell(0, 0), cell(0, 1)), 'Fire at 1 square');
  const fired = fire(fire(state, 1, cell(0, 0)), 2, cell(0, 0));
  assert.equal(refusal(fired, 1, cell(0, 0)), 'You already fired there');
  const salvo = playing({ salvo: true });
  assert.equal(refusal(salvo, 1, empty(0), empty(0), empty(1), empty(2), empty(3)), 'Fire at 5 different squares');
});

test('sinking every ship wins', () => {
  let state = playing();
  const targets = B.flatMap(ship => Array.from({ length: ship.length }, (_, i) => cell(ship.row, ship.col + i)));
  targets.forEach((target, i) => {
    state = fire(state, 1, target);
    if (i < targets.length - 1) state = fire(state, 2, empty(i));
  });
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.currentPlayer, null);
  assert.equal(state.gameStatus, 'Alice sank every ship. Alice wins!');
  assert.deepEqual(Object.keys(toPublicState(state, false, null).revealed), ['1', '2']);
});

test('salvo fires one shot per ship afloat', () => {
  let state = playing({ salvo: true });
  assert.equal(refusal(state, 1, empty(0)), 'Fire at 5 different squares');
  state = fire(state, 1, empty(0), empty(1), empty(2), empty(3), empty(4));
  assert.equal(state.gameStatus, 'Alice fired at A10, B10, C10, D10 and E10: miss, miss, miss, miss, miss');
  state = fire(state, 2, cell(4, 0), cell(4, 1), empty(5), empty(6), empty(7));
  assert.equal(state.shots[2][1].sunkLength, 2);
  assert.equal(refusal(state, 1, empty(5), empty(6), empty(7), empty(8), empty(9)), 'Fire at 4 different squares');
  state = fire(state, 1, empty(5), empty(6), empty(7), empty(8));
  assert.equal(state.shots[1].length, 9);
});

test('a salvo is capped at the squares left', () => {
  const shots: Shot[] = Array.from({ length: 97 }, (_, i) => ({ row: Math.floor(i / 10), col: i % 10, result: 'miss' as const }));
  const state = { shots: { 1: shots, 2: [] }, houseRules: withRules({ salvo: true }) };
  assert.equal(shotsAllowed(state, 1), 3);
  assert.equal(shotsAllowed(state, 2), 5);
  assert.equal(shotsAllowed({ ...state, houseRules: undefined }, 1), 1);
});

test('resigning during placement ends the game with one fleet revealed', () => {
  const result = applyAction(place(lobby(), 1, A), 2, { type: 'resign' });
  if ('error' in result) assert.fail(result.error);
  assert.equal(result.state.isGameOver, true);
  assert.deepEqual(result.state.winners, [1]);
  assert.deepEqual(Object.keys(toPublicState(result.state, false, null).revealed), ['1']);
});

test('waitingOn lists every seat still placing', () => {
  const state = lobby();
  assert.deepEqual(waitingOn(state), [1, 2]);
  const alice = place(state, 1, A);
  assert.deepEqual(waitingOn(alice), [2]);
  assert.deepEqual(waitingOn(place(alice, 2, B)), []);
});

test('a fleet reaches only its owner until the game is over', () => {
  const state = playing();
  assert.deepEqual(toPublicState(state, false, 1).myFleet, A);
  assert.deepEqual(toPublicState(state, false, 2).myFleet, B);
  assert.equal(toPublicState(state, false, null).myFleet, null);
  for (const viewer of [1, 2, null]) {
    const view = toPublicState(state, false, viewer);
    assert.equal('fleets' in view, false);
    assert.deepEqual(view.revealed, {});
    assert.deepEqual(view.ready, [1, 2]);
  }
});

test('resetLobby clears fleets and shots', () => {
  const state = fire(playing(), 1, cell(5, 0));
  const reset = naval.resetLobby(state, Math.random);
  assert.equal(reset.phase, 'placing');
  assert.deepEqual(reset.fleets, {});
  assert.deepEqual(reset.shots, { 1: [], 2: [] });
  assert.equal(reset.lastMove, null);
  assert.equal(reset.drawOffer, null);
  assert.equal(reset.gameStatus, 'Place your fleets');
});
