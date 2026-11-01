import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alertFor, alertText, tabTitle, votesWaitingOn } from './alerts.ts';
import { testGame } from './testGame.ts';
import type { BasePublicState, Seat } from './types.ts';

const info = testGame.info;

function view(seats: Seat[], patch: Partial<BasePublicState> = {}): BasePublicState {
  const state = testGame.createGameState('g1');
  const names = Object.fromEntries(seats.map(seat => [seat, ['', 'Ann', 'Bob', 'Cy', 'Di'][seat]]));
  return { ...testGame.toPublicState({ ...state, activePlayers: seats, playerNames: names }, false, null), moveCount: 0, ...patch };
}

const running = (patch: Partial<BasePublicState> = {}) => view([1, 2, 3, 4], { started: true, currentPlayer: 2, ...patch });

test('lobby, in-game and spectator titles', () => {
  assert.equal(tabTitle(info, view([1, 2]), []), 'Test · 2 of 4 players');
  assert.equal(tabTitle(info, running(), [1]), 'Test · 4 players');
  assert.equal(tabTitle(info, running(), [2]), '● Your turn · Test · 4 players');
  assert.equal(tabTitle(info, running(), []), 'Test · 4 players');
  assert.equal(tabTitle(info, view([1], { started: true }), []), 'Test · 1 player');
});

test('a vote waiting on you wins over your turn', () => {
  const undoVote = { requestedBy: 1, votes: { 1: true } };
  assert.equal(tabTitle(info, running({ undoVote }), [2]), '● Vote · Test · 4 players');
  assert.equal(tabTitle(info, running({ undoVote: { ...undoVote, votes: { 1: true, 2: true } } }), [2]), '● Your turn · Test · 4 players');
});

test('a disconnected seat is not waited on for undo or dismiss, and a dismiss target is never asked', () => {
  const undoVote = { requestedBy: 1, votes: { 1: true } };
  assert.deepEqual(votesWaitingOn(running({ undoVote, disconnected: [3] }), 3), []);
  assert.deepEqual(votesWaitingOn(running({ undoVote, disconnected: [3] }), 4), ['vote:undo:1']);
  const dismissVote = { target: 3, requestedBy: 1, votes: { 1: true } };
  assert.deepEqual(votesWaitingOn(running({ dismissVote }), 3), []);
  assert.deepEqual(votesWaitingOn(running({ dismissVote }), 2), ['vote:dismiss:3']);
  assert.deepEqual(votesWaitingOn(running({ dismissVote, disconnected: [2] }), 2), []);
});

test('rematch and hand requests wait on the seat they name', () => {
  const rematch = running({ isGameOver: true, rematchVote: { requestedBy: 1, votes: { 1: true } } });
  assert.deepEqual(votesWaitingOn(rematch, 2), ['vote:rematch:1']);
  assert.deepEqual(votesWaitingOn(rematch, 1), []);
  const hand = running({ handRequests: [{ spectator: 's1', seat: 3 }] });
  assert.equal(alertFor(info, hand, 3)?.key, 'vote:hand:s1');
  assert.equal(alertFor(info, hand, 2)?.kind, 'turn');
});

test('pass-and-play seats share one title', () => {
  assert.equal(tabTitle(info, running({ currentPlayer: 3 }), [1, 3]), '● Your turn · Test · 4 players');
});

test('alert text holds only the game, the ID and public names', () => {
  const over = running({ isGameOver: true, winners: [1] });
  assert.deepEqual(alertText(info, over, 'gameOver'), { title: 'Game over', body: 'Ann won Test' });
  assert.equal(alertText(info, running({ isGameOver: true }), 'gameOver').body, 'Draw in Test');
  assert.equal(alertText(info, view([1], { started: true, isGameOver: true }), 'gameOver').body, 'Test is over');
  assert.deepEqual(alertText(info, over, 'turn'), { title: 'Your turn', body: 'Test · g1' });
  assert.deepEqual(alertText(info, over, 'vote'), { title: 'A vote is waiting for you', body: 'Test · g1' });
  assert.deepEqual(alertText(info, over, 'turn', 'Bob'), { title: 'Your turn, Bob', body: 'Test · g1' });
  assert.deepEqual(alertText(info, over, 'vote', 'Bob'), { title: 'A vote is waiting for Bob', body: 'Test · g1' });
  const leaky = { ...over, secret: 'hidden' };
  for (const kind of ['turn', 'vote', 'gameOver'] as const) assert.ok(!JSON.stringify(alertText(info, leaky, kind)).includes('hidden'));
});

test('the key stays the same across moves in one turn', () => {
  assert.equal(alertFor(info, running({ moveCount: 3 }), 2)?.key, alertFor(info, running({ moveCount: 4 }), 2)?.key);
  assert.equal(alertFor(info, running(), 2)?.key, 'turn');
});

test('a view that waits on several seats alerts each of them, not the current player', () => {
  const state = running({ currentPlayer: 1, waitingOn: [2, 3] });
  assert.equal(alertFor(info, state, 2)?.kind, 'turn');
  assert.equal(alertFor(info, state, 3)?.kind, 'turn');
  assert.equal(alertFor(info, state, 1), null);
});

test('no turn alert alone at a table, outside the table, or before a lobby is agreed', () => {
  assert.equal(alertFor(info, view([1], { started: true, currentPlayer: 1 }), 1), null);
  assert.equal(alertFor(info, running(), 5), null);
  const rules = { ...info, houseRules: [{ id: 'x', label: 'X', kind: 'toggle' as const, standard: false }] };
  const lobby = view([1, 2], { currentPlayer: 1 });
  assert.equal(alertFor(rules, lobby, 1), null);
  const agreed = { ...lobby, houseRules: { host: 1, values: { x: false }, maxPlayers: null, agreed: [1, 2], revision: 1 } };
  assert.equal(alertFor(rules, agreed, 1)?.kind, 'turn');
});

test('a rematch vote waits on the seat that has not answered, and the rest get game over', () => {
  const over = running({ isGameOver: true, rematchVote: { requestedBy: 1, votes: { 1: true } } });
  assert.deepEqual(alertFor(info, over, 2), { kind: 'vote', key: 'vote:rematch:1' });
  assert.deepEqual(alertFor(info, over, 1), { kind: 'gameOver', key: 'gameOver' });
});

test('a pause vote waits on every seat that has not voted', () => {
  const state = running({ pauseVote: { requestedBy: 1, votes: { 1: true } } });
  assert.deepEqual(votesWaitingOn(state, 2), ['vote:pause:1']);
  assert.deepEqual(votesWaitingOn(state, 1), []);
});

test('a paused game alerts nobody', () => {
  assert.deepEqual(alertFor(info, running(), 2), { kind: 'turn', key: 'turn' });
  assert.equal(alertFor(info, running({ paused: true }), 2), null);
});
