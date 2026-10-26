import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeOpenGame, fetchOpenGames, joinRoleFor } from './openGames.ts';

const lobby = { gameType: 'chess', gameId: 'a', players: ['Alice'], playing: false };
const stubFetch = (impl: () => Promise<unknown>) => { globalThis.fetch = impl as unknown as typeof fetch; };
const respond = (status: number, body?: unknown) => () => Promise.resolve({ status, ok: status < 400, json: () => Promise.resolve(body) });

test('a game is described by its players and state', () => {
  assert.equal(describeOpenGame(lobby, 'Chess'), 'Alice in the lobby');
  assert.equal(describeOpenGame({ ...lobby, players: ['Alice', 'Bob'], playing: true }, 'Chess'), 'Alice, Bob currently playing Chess');
});
test('a game in progress is joined as a spectator', () => {
  assert.equal(joinRoleFor(lobby), 'player');
  assert.equal(joinRoleFor({ ...lobby, playing: true }), 'spectator');
});
test('a 404 means the server does not list games', async () => {
  stubFetch(respond(404));
  assert.equal(await fetchOpenGames(), 'off');
});
test('errors fail the fetch', async () => {
  stubFetch(respond(500));
  assert.equal(await fetchOpenGames(), 'failed');
  stubFetch(() => Promise.reject(new Error('down')));
  assert.equal(await fetchOpenGames(), 'failed');
  stubFetch(respond(200, {}));
  assert.equal(await fetchOpenGames(), 'failed');
});
test('the list is returned without malformed entries', async () => {
  stubFetch(respond(200, { games: [lobby, { gameType: 'chess', gameId: 1 }] }));
  assert.deepEqual(await fetchOpenGames(), [lobby]);
});
