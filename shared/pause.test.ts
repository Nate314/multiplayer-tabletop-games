import { test } from 'node:test';
import assert from 'node:assert/strict';
import { castPauseVote, openPauseVote, pauseVotePassed } from './pause.ts';
import { baseGameState } from './seating.ts';
import type { BaseGameState } from './types.ts';

function started(patch: Partial<BaseGameState> = {}): BaseGameState {
  return {
    ...baseGameState('g'), started: true, currentPlayer: 1, activePlayers: [1, 2],
    playerNames: { 1: 'Alice', 2: 'Bob' }, ...patch
  };
}

const open = (state: BaseGameState, seat = 1) => {
  const result = openPauseVote(state, seat);
  if ('error' in result) throw new Error(result.error);
  return result.state;
};

test('openPauseVote refuses before the start, after the end, while paused, during another vote and with a seat disconnected', () => {
  assert.deepEqual(openPauseVote(started({ started: false }), 1), { error: 'The game has not started' });
  assert.deepEqual(openPauseVote(started({ isGameOver: true }), 1), { error: 'The game is over' });
  assert.deepEqual(openPauseVote(started({ paused: true }), 1), { error: 'The game is already paused' });
  const vote = { requestedBy: 2, votes: { 2: true } };
  for (const patch of [{ undoVote: vote }, { dismissVote: { target: 2, ...vote } }, { rematchVote: vote }, { pauseVote: vote }]) {
    assert.deepEqual(openPauseVote(started(patch), 1), { error: 'A vote is already in progress' });
  }
  assert.deepEqual(openPauseVote(started({ disconnected: [2] }), 1), { error: 'Everyone must be here to pause' });
});

test('openPauseVote opens a vote the requester has approved', () => {
  const state = open(started());
  assert.deepEqual(state.pauseVote, { requestedBy: 1, votes: { 1: true } });
  assert.equal(state.gameStatus, 'Alice wants to pause the game');
});

test('castPauseVote declines, refuses a second vote and records an approval', () => {
  assert.deepEqual(castPauseVote(started(), 2, true), { error: 'No pause vote in progress' });
  const voting = open(started());
  assert.deepEqual(castPauseVote(voting, 1, true), { error: 'You already voted' });
  const declined = castPauseVote(voting, 2, false);
  assert.ok('state' in declined);
  assert.equal(declined.state.pauseVote, null);
  assert.equal(declined.state.gameStatus, 'Bob declined to pause');
  const approved = castPauseVote(voting, 2, true);
  assert.ok('state' in approved);
  assert.deepEqual(approved.state.pauseVote, { requestedBy: 1, votes: { 1: true, 2: true } });
});

test('pauseVotePassed needs every seated player', () => {
  const voting = open(started());
  assert.equal(pauseVotePassed(started()), false);
  assert.equal(pauseVotePassed(voting), false);
  const approved = castPauseVote(voting, 2, true);
  assert.ok('state' in approved);
  assert.equal(pauseVotePassed(approved.state), true);
});
