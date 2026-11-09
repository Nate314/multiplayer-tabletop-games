import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categories } from './index.ts';
import { applyAction, createGameState, privateSeatView, resetLobby, toPublicState } from './rules.ts';
import type { GameState, Seat } from './types.ts';
import { withRules } from '../../server/testing.ts';
import { seeded } from '../testStates.ts';

const ANSWERS: Record<number, string[]> = { 1: ['Banana', 'Bat'], 2: ['Berry', 'Bear'], 3: ['Blueberry', 'Beaver'] };

function answering(): GameState {
  const base: GameState = {
    ...createGameState('g1'), activePlayers: [1, 2, 3], playerNames: { 1: 'Ann', 2: 'Bob', 3: 'Cy' }, houseRules: withRules({})
  };
  return { ...resetLobby(base, seeded(1)), letter: 'B', list: ['Fruits', 'Animals'], phaseStartedAt: 1, answers: { ...ANSWERS } };
}

function reviewing(): GameState {
  let state = answering();
  for (const seat of [1, 2, 3]) {
    const result = applyAction(state, seat, { type: 'done', answers: ANSWERS[seat] }, Math.random, 2);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

test('while answering a seat sees only its own answers and History none', () => {
  const state = answering();
  for (const viewer of [1, 2, 3, null] as (Seat | null)[]) {
    const view = toPublicState(state, false, viewer);
    assert.deepEqual(view.answers, viewer === null ? {} : { [viewer]: ANSWERS[viewer] });
    assert.deepEqual(view.verdicts, {});
    assert.deepEqual(view.roundPoints, {});
    const json = JSON.stringify(view);
    for (const [seat, texts] of Object.entries(ANSWERS)) {
      if (Number(seat) !== viewer) for (const text of texts) assert.equal(json.includes(text), false, `${viewer} sees ${text}`);
    }
  }
});

test('the review shows every answer with its verdict and points', () => {
  const view = toPublicState(reviewing(), false, null);
  assert.deepEqual(view.answers, ANSWERS);
  assert.equal(view.verdicts[1]?.length, 2);
  assert.deepEqual(view.roundPoints, { 1: 2, 2: 2, 3: 2 });
});

test('the null view plus privateSeatView is the seat view', () => {
  for (const state of [answering(), reviewing()]) {
    for (const seat of [1, 2, 3]) {
      assert.deepEqual({ ...toPublicState(state, false, null), ...privateSeatView(state, seat) }, toPublicState(state, false, seat));
    }
  }
});

test('no view holds the letters or categories still to come', () => {
  for (const state of [answering(), reviewing()]) {
    const secret = categories.secretState!(state);
    assert.ok(state.letters.length > 0 && state.pool.length > 0);
    for (const viewer of [1, null] as (Seat | null)[]) {
      const view = toPublicState(state, false, viewer);
      assert.equal('letters' in view || 'pool' in view, false);
      const json = JSON.stringify(view);
      for (const word of state.pool.slice(0, 5)) assert.equal(json.includes(word), false, word);
    }
    assert.deepEqual(Object.keys(secret as object).sort(), ['letters', 'pool']);
  }
});
