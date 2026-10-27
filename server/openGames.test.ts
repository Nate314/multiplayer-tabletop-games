import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'net';
import { mountOpenGamesRoute } from './openGames.ts';

const games = [{ gameType: 'chess', gameId: 'fri', players: ['Alice'], playing: false }];
const app = express();
mountOpenGamesRoute(app, () => games);
const server = app.listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
after(() => server.close());

test('the open games route serves the list it is given', async () => {
  const response = await fetch(`${base}/api/open-games`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { games });
});
