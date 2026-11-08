import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fictionary } from './index.ts';
import { applyAction, createGameState, privateSeatView, toPublicState } from './rules.ts';
import { addPlayer } from '../../shared/seating.ts';
import { withRules } from '../../server/testing.ts';
import type { Result, Seat } from '../../shared/types.ts';
import type { GameState } from './types.ts';

const NOW = 1_000_000;
const first = () => 0;
const QUILLON = { word: 'quillon', definition: 'either arm of the cross guard of a sword' };
const VIEWERS: (Seat | null)[] = [null, 1, 2, 3];

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// Alice, Bob and Cara writing a definition of quillon from NOW
function writing(): GameState {
  let state: GameState = { ...createGameState('g'), houseRules: withRules({}) };
  for (const name of ['Alice', 'Bob', 'Cara']) state = ok(addPlayer(fictionary, state, name, first));
  return { ...state, deck: [QUILLON, ...state.deck.slice(1)], ...QUILLON, phaseStartedAt: NOW, started: true };
}

const write = (state: GameState, seat: Seat, text: string) => ok(applyAction(state, seat, { type: 'write', text }, first, NOW));
const vote = (state: GameState, seat: Seat, choice: number) => ok(applyAction(state, seat, { type: 'vote', choice }, first, NOW));
const indexOf = (state: GameState, text: string) => state.choices.findIndex(choice => choice.text === text);

const FAKES = ['a small bird', 'a kind of pastry', 'a river boat'];
const halfWritten = () => write(write(writing(), 1, FAKES[0]), 2, FAKES[1]);
const voting = () => write(halfWritten(), 3, FAKES[2]);
// Alice votes for Bob's fake; Bob has not voted yet
const halfVoted = () => vote(voting(), 1, indexOf(voting(), FAKES[1]));
// Bob votes for the real one, Cara for Alice's fake
const revealed = () => vote(vote(halfVoted(), 2, indexOf(voting(), QUILLON.definition)), 3, indexOf(voting(), FAKES[0]));

const leaks = (view: unknown, text: string) => JSON.stringify(view).includes(text);
// During voting the real definition is one of the choices, shown as a bare text like every fake; anywhere else it leaks
const unmarked = (view: unknown, text: string) => JSON.stringify(view).replaceAll(`{"text":${JSON.stringify(text)}}`, '');

test('nobody sees the real definition before the reveal', () => {
  for (const state of [writing(), halfWritten(), voting(), halfVoted()]) {
    for (const viewer of VIEWERS) {
      const view = toPublicState(state, false, viewer);
      assert.equal(view.definition, null);
      assert.equal(unmarked(view, QUILLON.definition).includes('cross guard'), false, `${state.phase} leaks to ${viewer}`);
      assert.equal('deck' in view, false);
    }
  }
  for (const viewer of VIEWERS) {
    assert.equal(revealed().phase, 'reveal');
    assert.equal(toPublicState(revealed(), false, viewer).definition, QUILLON.definition);
  }
});

test('a seat sees only its own submission while writing', () => {
  const state = halfWritten();
  const bob = toPublicState(state, false, 2);
  assert.equal(bob.submission, FAKES[1]);
  assert.equal(leaks(bob, FAKES[0]), false);
  assert.deepEqual(bob.written, [1, 2]);
  const none = toPublicState(state, false, null);
  assert.equal(none.submission, null);
  assert.equal(leaks(none, FAKES[0]) || leaks(none, FAKES[1]), false);
});

test('during voting no view says who wrote a choice or which is real', () => {
  const state = halfVoted();
  for (const viewer of VIEWERS) {
    const view = toPublicState(state, false, viewer);
    assert.equal(view.choices.length, 4);
    for (const choice of view.choices) assert.deepEqual(Object.keys(choice), ['text']);
    const own = viewer === null ? null : indexOf(state, FAKES[viewer - 1]);
    assert.equal(view.ownChoice, own, `ownChoice of ${viewer}`);
  }
});

test('votes are hidden until the reveal, except your own', () => {
  const state = halfVoted();
  const alice = toPublicState(state, false, 1);
  assert.equal(alice.myVote, indexOf(state, FAKES[1]));
  assert.deepEqual(alice.votes, {});
  assert.deepEqual(alice.voted, [1]);
  for (const viewer of [null, 2, 3]) {
    const view = toPublicState(state, false, viewer);
    assert.equal(view.myVote, null);
    assert.deepEqual(view.votes, {});
    assert.deepEqual(view.voted, [1]);
  }
});

test('the reveal shows every author and every vote', () => {
  const state = revealed();
  const view = toPublicState(state, false, null);
  assert.deepEqual(view.choices, state.choices);
  assert.deepEqual(view.votes, state.votes);
  assert.equal(Object.keys(view.votes).length, 3);
  assert.deepEqual(view.choices[indexOf(state, FAKES[0])].authors, [1]);
});

test('the null view plus privateSeatView is the seat view', () => {
  for (const state of [writing(), halfWritten(), voting(), halfVoted(), revealed()]) {
    for (const seat of [1, 2, 3]) {
      assert.deepEqual({ ...toPublicState(state, false, null), ...privateSeatView(state, seat) }, toPublicState(state, false, seat), `${state.phase} seat ${seat}`);
    }
  }
});
