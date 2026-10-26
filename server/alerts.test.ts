import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAlerts } from './alerts.ts';
import { openPushStore } from './pushStore.ts';
import { createVapidKeys } from './vapid.ts';
import { testGame } from '../shared/testGame.ts';
import type { BasePublicState, Seat } from '../shared/types.ts';

const ROOM = 'test/g1';
const ANN = 'https://fcm.googleapis.com/fcm/send/ann';
const BOB = 'https://updates.push.services.mozilla.com/wpush/v2/bob';
const keys = createVapidKeys();

type Sent = { endpoint: string; headers: Record<string, string>; args: number };

function setup(result: 'sent' | 'gone' | 'failed' = 'sent') {
  const store = openPushStore(':memory:');
  const sent: Sent[] = [];
  const send = async (...args: [string, Record<string, string>]) => {
    sent.push({ endpoint: args[0], headers: args[1], args: args.length });
    return result;
  };
  const alerts = createAlerts({ store, keys, subject: 'mailto:a@b.c', games: [testGame.info], send });
  store.add(ROOM, 1, ANN);
  store.add(ROOM, 2, BOB);
  return { store, sent, alerts };
}

function state(patch: Partial<BasePublicState> = {}): BasePublicState {
  const base = testGame.createGameState('g1');
  return {
    ...testGame.toPublicState({ ...base, activePlayers: [1, 2], playerNames: { 1: 'Ann', 2: 'Bob' } }, false, null),
    moveCount: 0, started: true, currentPlayer: 1, ...patch
  };
}

const views = (patch: Partial<BasePublicState> = {}) => new Map<Seat, BasePublicState>([[1, state(patch)], [2, state(patch)]]);
const none = new Set<Seat>();
const flush = () => new Promise(resolve => setImmediate(resolve));

test('a new turn pushes the player once, and moves within it do not', () => {
  const { sent, alerts } = setup();
  alerts.roomChanged(ROOM, views({ currentPlayer: 1 }), none);
  alerts.roomChanged(ROOM, views({ currentPlayer: 2 }), none);
  alerts.roomChanged(ROOM, views({ currentPlayer: 2, moveCount: 1 }), none);
  assert.deepEqual(sent.map(call => call.endpoint), [BOB]);
});

test('a visible seat is not pushed', () => {
  const { sent, alerts } = setup();
  alerts.roomChanged(ROOM, views({ currentPlayer: 1 }), none);
  alerts.roomChanged(ROOM, views({ currentPlayer: 2 }), new Set([2]));
  assert.deepEqual(sent, []);
});

test('the first look at a room after a restart sends nothing', () => {
  const { sent, alerts } = setup();
  alerts.roomChanged(ROOM, views({ currentPlayer: 2, undoVote: { requestedBy: 2, votes: { 2: true } } }), none);
  assert.deepEqual(sent, []);
});

test('a vote waiting on a seat pushes it, and the alert text is what pending returns', () => {
  const { sent, alerts } = setup();
  alerts.roomChanged(ROOM, views({ currentPlayer: 2 }), none);
  alerts.roomChanged(ROOM, views({ currentPlayer: 2, undoVote: { requestedBy: 2, votes: { 2: true } } }), none);
  assert.deepEqual(sent.map(call => call.endpoint), [ANN]);
  assert.deepEqual(alerts.pending(ANN), [{ title: 'A vote is waiting for you', body: 'Test · g1', tag: 'test/g1', url: '/join/test/g1' }]);
  assert.deepEqual(alerts.pending(ANN), []);
});

test('a newer alert for the same game replaces the older one', () => {
  const { alerts } = setup();
  alerts.roomChanged(ROOM, views({ currentPlayer: 2 }), none);
  alerts.roomChanged(ROOM, views({ currentPlayer: 1 }), none);
  alerts.roomChanged(ROOM, views({ currentPlayer: 1, undoVote: { requestedBy: 2, votes: { 2: true } } }), none);
  assert.deepEqual(alerts.pending(ANN).map(alert => alert.title), ['A vote is waiting for you']);
});

test('a device holding two seats of a game is told whose turn it is', () => {
  const { store, alerts } = setup();
  store.add(ROOM, 2, ANN);
  alerts.roomChanged(ROOM, views({ currentPlayer: 1 }), none);
  alerts.roomChanged(ROOM, views({ currentPlayer: 2 }), none);
  assert.deepEqual(alerts.pending(ANN).map(alert => alert.title), ['Your turn, Bob']);
});

test('game over pushes everyone not looking, a rematch vote still pushes, and the next game forgets the room', () => {
  const { store, sent, alerts } = setup();
  const over = { currentPlayer: null, isGameOver: true, winners: [1] };
  alerts.roomChanged(ROOM, views({ currentPlayer: 1 }), none);
  alerts.roomChanged(ROOM, views(over), new Set([1]));
  assert.deepEqual(sent.map(call => call.endpoint), [BOB]);
  assert.deepEqual(alerts.pending(BOB), [{ title: 'Game over', body: 'Ann won Test', tag: 'test/g1', url: '/join/test/g1' }]);
  alerts.roomChanged(ROOM, views({ ...over, rematchVote: { requestedBy: 1, votes: { 1: true } } }), none);
  assert.deepEqual(sent.map(call => call.endpoint), [BOB, BOB]);
  assert.deepEqual(alerts.pending(BOB).map(alert => alert.title), ['A vote is waiting for you']);
  alerts.roomChanged(ROOM, views({ started: false, currentPlayer: 1, gameNumber: 2 }), none);
  assert.deepEqual(store.roomIds(), []);
});

test('a seat that left, a gone endpoint and a deleted room are removed', async () => {
  const left = setup();
  left.alerts.roomChanged(ROOM, new Map([[1, state({ activePlayers: [1], playerNames: { 1: 'Ann' } })]]), none);
  assert.deepEqual(left.store.endpoints(ROOM, 2), []);

  const gone = setup('gone');
  gone.alerts.roomChanged(ROOM, views({ currentPlayer: 1 }), none);
  gone.alerts.roomChanged(ROOM, views({ currentPlayer: 2 }), none);
  await flush();
  assert.deepEqual(gone.store.endpoints(ROOM, 2), []);

  const deleted = setup();
  deleted.alerts.roomChanged(ROOM, null, none);
  assert.deepEqual(deleted.store.endpoints(ROOM, 1), []);
  assert.deepEqual(deleted.store.roomIds(), []);
});

test('a send that fails never throws out of roomChanged', async () => {
  const store = openPushStore(':memory:');
  store.add(ROOM, 2, BOB);
  const send = (): Promise<'sent'> => { throw new Error('boom'); };
  const alerts = createAlerts({ store, keys, subject: 'mailto:a@b.c', games: [testGame.info], send });
  alerts.roomChanged(ROOM, views({ currentPlayer: 1 }), none);
  assert.doesNotThrow(() => alerts.roomChanged(ROOM, views({ currentPlayer: 2 }), none));
  await flush();
});

test('pushes carry the same Topic for one game and no body', () => {
  const { sent, alerts } = setup();
  alerts.roomChanged(ROOM, views({ currentPlayer: 1 }), none);
  alerts.roomChanged(ROOM, views({ currentPlayer: 2 }), none);
  alerts.roomChanged(ROOM, views({ currentPlayer: 1 }), none);
  assert.equal(sent.length, 2);
  assert.match(sent[0].headers.Topic, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(sent[0].headers.Topic, sent[1].headers.Topic);
  assert.ok(sent[0].headers.Authorization.startsWith('vapid t='));
  assert.deepEqual(sent.map(call => call.args), [2, 2]);
});
