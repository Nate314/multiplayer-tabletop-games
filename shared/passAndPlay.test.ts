import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextShownSeat, seatsToAct } from './passAndPlay.ts';
import { testGame } from './testGame.ts';
import type { TestState } from './testGame.ts';

const table = (overrides: Partial<TestState> = {}): TestState => ({
  ...testGame.createGameState('g1'), started: true, activePlayers: [1, 2, 3], currentPlayer: 2, ...overrides
});

test('the seat holding the turn is the one to act', () => {
  assert.deepEqual(seatsToAct(testGame, table()), [2]);
});

test('nobody acts once the game is over', () => {
  assert.deepEqual(seatsToAct(testGame, table({ isGameOver: true, currentPlayer: null })), []);
});

test('connected seats that have not voted on an undo are waited on', () => {
  const undoVote = { requestedBy: 1, votes: { 1: true } };
  assert.deepEqual(seatsToAct(testGame, table({ undoVote })), [2, 3]);
});

test('a disconnected seat does not hold up a vote', () => {
  const undoVote = { requestedBy: 1, votes: { 1: true } };
  assert.deepEqual(seatsToAct(testGame, table({ undoVote, disconnected: [3] })), [2]);
});

test('a dismiss vote waits on the seats that have not voted', () => {
  const dismissVote = { target: 3, requestedBy: 1, votes: { 1: true } };
  assert.deepEqual(seatsToAct(testGame, table({ dismissVote, currentPlayer: 1, disconnected: [3] })), [1, 2]);
});

test('seats a hand request names are waited on', () => {
  assert.deepEqual(seatsToAct(testGame, table({ handRequests: [{ spectator: 's', seat: 3 }] })), [2, 3]);
});

test('the game adds its out-of-turn waits', () => {
  const game = { ...testGame, waitingOn: () => [3, 1, 2] };
  assert.deepEqual(seatsToAct(game, table()), [1, 2, 3]);
});

test('a private hand is hidden while another local seat is waited on', () => {
  assert.equal(nextShownSeat(1, [1, 2], [2], true), null);
  assert.equal(nextShownSeat(1, [1, 2], [1, 3], true), 1);
  assert.equal(nextShownSeat(1, [1, 2], [3], true), 1);
});

test('without private hands the view follows the first waiting local seat', () => {
  assert.equal(nextShownSeat(null, [1, 2], [2], false), 2);
  assert.equal(nextShownSeat(1, [1, 2], [3], false), 1);
});
