import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSeat, partnerOf, partnershipBroken, teamNames, teamOf, teamSeats } from './partnerships.ts';
import { testGame } from './testGame.ts';

const names = { 1: 'Alice', 2: 'Ben', 3: 'Cara', 4: 'Dan' };

test('seats 1 and 3 are team 0', () => {
  assert.deepEqual([1, 2, 3, 4].map(teamOf), [0, 1, 0, 1]);
  assert.deepEqual(teamSeats(0), [1, 3]);
  assert.deepEqual(teamSeats(1), [2, 4]);
});

test('next seat wraps from 4 to 1', () => {
  assert.deepEqual([1, 2, 3, 4].map(nextSeat), [2, 3, 4, 1]);
});

test('partner of 2 is 4', () => {
  assert.deepEqual([1, 2, 3, 4].map(partnerOf), [3, 4, 1, 2]);
});

test('team names join with and', () => {
  assert.equal(teamNames(0, names), 'Alice and Cara');
});

test('a broken partnership ends the game for the other team', () => {
  const state = { ...testGame.createGameState('g'), playerNames: names, currentPlayer: 2, undoVote: { requestedBy: 1, votes: {} } };
  const next = partnershipBroken(state, 1);
  assert.equal(next.isGameOver, true);
  assert.equal(next.currentPlayer, null);
  assert.equal(next.undoVote, null);
  assert.deepEqual(next.winners, [2, 4]);
  assert.equal(next.gameStatus, 'Alice left, so the partnership is broken: Ben and Dan win');
});
