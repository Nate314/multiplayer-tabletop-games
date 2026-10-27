import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'net';
import { mountStatsRoutes } from './routes.ts';
import { openStatsStore } from './store.ts';
import { createLinkCodes, LINK_CODE_TTL_MS } from './linkCodes.ts';
import { hashDeviceId } from '../devices.ts';
import type { GameResult } from '../../shared/types.ts';
import type { StatsGame } from '../../shared/stats.ts';

const [A, B, C, D, E] = ['a', 'b', 'c', 'd', 'e'].map(letter => `device-${letter}-0123456789abcdef`);
const hash = (id: string) => hashDeviceId(id) as string;

function finished(n: number, players: [string, string][]): GameResult {
  const at = Date.now() - 1000;
  return {
    archiveId: `test/g${n}#1`, gameType: 'test', gameId: `g${n}`, startedAt: at - 1000, finishedAt: at, moveCount: 3,
    standings: players.map((_, index) => ({ seat: index + 1, place: index + 1 })),
    players: players.map(([name, id], index) => ({ seat: index + 1, name, deviceId: hash(id) }))
  };
}

const stats = openStatsStore(':memory:');
stats.record(finished(1, [['Ann', A], ['Bob', B]]));
stats.record(finished(2, [['Cy', C], ['Dee', E]]));
const clock = { now: 0 };
const app = express();
mountStatsRoutes(app, stats, createLinkCodes(() => clock.now));
const server = app.listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
after(() => server.close());

const bodies: string[] = []; // every response body, checked for secrets at the end

async function post(path: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const text = await response.text();
  bodies.push(text);
  return { status: response.status, json: JSON.parse(text) };
}

test('a device sees the games it played and how many devices it has', async () => {
  const { status, json } = await post('/api/stats', { deviceId: A });
  assert.equal(status, 200);
  const games = json.games as StatsGame[];
  assert.equal(games.length, 1);
  assert.equal(games[0].archiveId, 'test/g1#1');
  assert.equal(games[0].historyAvailable, true);
  assert.deepEqual(games[0].players.map(({ name, you }) => [name, you]), [['Ann', true], ['Bob', false]]);
  assert.equal(json.devices, 1);
});

test('a request without a device is a 400 or a 404, never a 500', async () => {
  for (const path of ['/api/stats', '/api/stats/clear', '/api/stats/link-code', '/api/stats/link']) {
    assert.equal((await fetch(`${base}${path}`)).status, 404);
    for (const body of [{}, { deviceId: 'short' }, { deviceId: 42 }]) {
      assert.deepEqual(await post(path, body), { status: 400, json: { error: 'Missing device' } });
    }
    const raw = await fetch(`${base}${path}`, { method: 'POST', body: 'not json' });
    assert.equal(raw.status, 400);
    const broken = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(broken.status, 400);
  }
});

test('a link code joins another device once, within 10 minutes', async () => {
  const issued = await post('/api/stats/link-code', { deviceId: A });
  assert.equal(issued.status, 200);
  assert.equal(issued.json.expiresAt, LINK_CODE_TTL_MS);
  const code = String(issued.json.code);
  assert.deepEqual(await post('/api/stats/link', { deviceId: D, code: code.toLowerCase() }), { status: 200, json: { games: 0 } });
  const linked = await post('/api/stats', { deviceId: D });
  assert.equal((linked.json.games as StatsGame[]).length, 1);
  assert.equal(linked.json.devices, 2);
  const used = { status: 400, json: { error: 'That code has expired or was already used' } };
  assert.deepEqual(await post('/api/stats/link', { deviceId: C, code }), used);
  assert.deepEqual(await post('/api/stats/link', { deviceId: C }), used);

  const own = await post('/api/stats/link-code', { deviceId: D });
  assert.deepEqual(await post('/api/stats/link', { deviceId: A, code: own.json.code }), {
    status: 400, json: { error: 'This device is already linked' }
  });

  const late = await post('/api/stats/link-code', { deviceId: C });
  clock.now += LINK_CODE_TTL_MS;
  assert.deepEqual(await post('/api/stats/link', { deviceId: E, code: late.json.code }), used);
});

test('clearing removes the person from their games, and the others see a Former player', async () => {
  assert.deepEqual(await post('/api/stats/clear', { deviceId: A }), { status: 200, json: { games: 1, devices: 2 } });
  const seen = await post('/api/stats', { deviceId: B });
  assert.deepEqual((seen.json.games as StatsGame[])[0].players.map(({ name }) => name), ['Former player', 'Bob']);
  assert.deepEqual(await post('/api/stats', { deviceId: A }), { status: 200, json: { cleared: true } });
  assert.deepEqual(await post('/api/stats', { deviceId: D }), { status: 200, json: { cleared: true } });
  assert.deepEqual(await post('/api/stats/clear', { deviceId: C }), { status: 200, json: { games: 1, devices: 1 } });
});

test('a cleared device is not linked', async () => {
  const issued = await post('/api/stats/link-code', { deviceId: B });
  assert.deepEqual(await post('/api/stats/link', { deviceId: A, code: issued.json.code }), { status: 200, json: { cleared: true } });
  const fromCleared = await post('/api/stats/link-code', { deviceId: A });
  assert.deepEqual(await post('/api/stats/link', { deviceId: E, code: fromCleared.json.code }), {
    status: 400, json: { error: 'That code has expired or was already used' }
  });
});

test('a malformed or oversized body is a quiet 400 that echoes nothing', async (t) => {
  const logged = t.mock.method(console, 'error', () => {});
  const written = t.mock.method(process.stderr, 'write', () => true);
  for (const body of [`{"deviceId":"${A}",`, JSON.stringify({ deviceId: A, pad: 'x'.repeat(2000) })]) {
    const response = await fetch(`${base}/api/stats`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Missing device' });
  }
  assert.equal(logged.mock.callCount(), 0);
  assert.equal(written.mock.callCount(), 0);
});

test('no response carries a raw device ID, a hash or a person', () => {
  const text = bodies.join('\n');
  assert.ok(bodies.length > 20);
  for (const id of [A, B, C, D, E]) {
    assert.ok(!text.includes(id), id);
    assert.ok(!text.includes(hash(id)), hash(id));
  }
  assert.ok(!/person/i.test(text));
});
