import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, applyMove, createGameState, resetLobby, spectatorState, toPublicState } from './rules.ts';
import { codebreaker } from './index.ts';
import type { Color, GameState, Seat } from './types.ts';
import { withRules } from '../../server/testing.ts';
import { seeded } from '../testStates.ts';

const CODE: Color[] = ['red', 'blue', 'green', 'yellow'];
const WRONG: Color[] = ['purple', 'purple', 'purple', 'purple'];
const NAMES = { 1: 'Alice', 2: 'Bob', 3: 'Cara' };

// A lobby at `seats` in `mode`; `started` swaps the drawn code for CODE
function lobby(mode: string, seats: Seat[], started = true): GameState {
  const state: GameState = {
    ...createGameState('g1'), activePlayers: seats, currentPlayer: seats[0], playerNames: NAMES, houseRules: withRules({ mode, code: '4of6' })
  };
  const reset = resetLobby(state, seeded(3));
  return started ? { ...reset, started: true, ...(reset.code && { code: CODE }) } : reset;
}

function ok(result: { state: GameState } | { error: string }): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const guess = (state: GameState, seat: Seat, pegs: Color[]): GameState => ok(applyAction(state, seat, { type: 'guess', pegs }));

// Whether a view anywhere holds `code` as a row of pegs
const shows = (view: unknown, code: Color[]): boolean => JSON.stringify(view).includes(JSON.stringify(code));

// Every way the state is shown: each seat, the history (null), a spectator and a table screen
function views(state: GameState): [string, unknown][] {
  return [
    ['history', toPublicState(state, false, null)],
    ['spectator', spectatorState(state, false, false)],
    ['table screen', spectatorState(state, false, true)],
    ...state.activePlayers.map(seat => [`seat ${seat}`, toPublicState(state, false, seat)] as [string, unknown])
  ];
}

function assertHidden(state: GameState, code: Color[], except: string[] = []): void {
  for (const [who, view] of views(state)) assert.equal(shows(view, code), except.includes(who), `${who} sees the code: ${!except.includes(who)}`);
}

test('Classic: only the maker sees the code before the round ends', () => {
  const set = ok(applyMove(lobby('classic', [1, 2]), 1, { type: 'setCode', pegs: CODE }));
  assert.equal(set.phase, 'breaking');
  assertHidden(set, CODE, ['seat 1']);
  assert.deepEqual(toPublicState(set, false, 1).code, CODE);
  assert.equal(toPublicState(set, false, 2).code, null);
  const guessed = ok(applyMove(set, 2, { type: 'guess', pegs: WRONG }));
  assertHidden(guessed, CODE, ['seat 1']);
  const ended = ok(applyMove(guessed, 2, { type: 'guess', pegs: CODE }));
  assert.equal(ended.phase, 'summary');
  for (const [who, view] of views(ended)) assert.deepEqual((view as { code: Color[] }).code, CODE, who);
});

test('Solo, Together, Race: nobody sees the code before game over', () => {
  for (const [mode, seats] of [['solo', [1]], ['together', [1, 2, 3]], ['race', [1, 2, 3]]] as [string, Seat[]][]) {
    const drawn = lobby(mode, seats, false);
    assert.ok(drawn.code, mode);
    assertHidden(drawn, drawn.code);
    let state = lobby(mode, seats);
    state = mode === 'solo' ? ok(applyMove(state, 1, { type: 'guess', pegs: WRONG })) : guess(state, 1, WRONG);
    assertHidden(state, CODE);
    for (const seat of seats) {
      state = mode === 'solo' ? ok(applyMove(state, seat, { type: 'guess', pegs: CODE })) : guess(state, seat, CODE);
      if (state.isGameOver) break;
      // A broken Race board ends in the code, seen by its owner and by spectators, who see every board; the code field stays null
      const broke = state.finishOrder.length > 0;
      assertHidden(state, CODE, [...state.finishOrder.map(finisher => `seat ${finisher}`), ...(broke ? ['spectator'] : [])]);
      assert.equal(spectatorState(state, false, false).code, null);
    }
    assert.equal(state.isGameOver, true, mode);
    for (const [who, view] of views(state)) assert.deepEqual((view as { code: Color[] }).code, CODE, `${mode} ${who}`);
  }
});

test('Race: a player sees only their own board, progress and counts of the others', () => {
  const close: Color[] = ['red', 'blue', 'purple', 'purple'];
  const state = guess(guess(guess(lobby('race', [1, 2, 3]), 1, close), 2, WRONG), 2, WRONG);
  const own = toPublicState(state, false, 1);
  assert.deepEqual(Object.keys(own.boards), ['1']);
  assert.deepEqual(own.progress, { 1: 50, 2: 0, 3: 0 });
  assert.deepEqual(own.guessesUsed, { 1: 1, 2: 2, 3: 0 });
  assert.deepEqual(toPublicState(state, false, null).boards, {});
  assert.deepEqual(toPublicState(state, false, null).guessesUsed, { 1: 1, 2: 2, 3: 0 });
  assert.deepEqual(spectatorState(state, false, false).boards, state.boards);
  assert.deepEqual(spectatorState(state, false, true).boards, {}, 'a table screen faces the players, so it shows no board');

  const over = guess(guess(guess(state, 1, CODE), 3, WRONG), 3, WRONG);
  assert.equal(over.isGameOver, true);
  assert.deepEqual(over.winners, [1]);
  for (const [who, view] of views(over)) assert.deepEqual((view as { boards: unknown }).boards, over.boards, who);
});

test('secretState names the code exactly when the computer made it', () => {
  const secret = codebreaker.secretState!;
  const classic = lobby('classic', [1, 2]);
  assert.deepEqual(secret(classic), {});
  assert.deepEqual(secret(ok(applyMove(classic, 1, { type: 'setCode', pegs: CODE }))), {});
  for (const [mode, seats] of [['solo', [1]], ['together', [1, 2]], ['race', [1, 2]]] as [string, Seat[]][]) {
    const state = lobby(mode, seats);
    assert.deepEqual(secret(state), { code: CODE }, mode);
    assert.deepEqual(secret({ ...state, isGameOver: true }), {}, mode);
  }
});

test('privateSeatView is the code and boards of the seat\'s own view', () => {
  const set = ok(applyMove(lobby('classic', [1, 2]), 1, { type: 'setCode', pegs: CODE }));
  assert.deepEqual(codebreaker.privateSeatView!(set, 1), { code: CODE, boards: {} });
  assert.deepEqual(codebreaker.privateSeatView!(set, 2), { code: null, boards: {} });
});
