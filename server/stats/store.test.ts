import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openStatsStore } from './store.ts';
import { hashDeviceId } from '../devices.ts';
import type { GameResult } from '../../shared/types.ts';

const RAW = { A: 'a'.repeat(32), B: 'b'.repeat(32), C: 'c'.repeat(32) };
const [A, B, C] = [RAW.A, RAW.B, RAW.C].map(raw => hashDeviceId(raw) as string);

function result(archiveId: string, devices: (string | undefined)[], extra: Partial<GameResult> = {}): GameResult {
  return {
    archiveId, gameType: 'hearts', gameId: archiveId, startedAt: 1, finishedAt: 2, moveCount: 5,
    standings: devices.map((_, seat) => ({ seat, place: seat + 1, score: String(10 * seat) })),
    players: devices.map((deviceId, seat) => ({ seat, name: `P${seat}`, deviceId })),
    ...extra
  };
}

function tempFile(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mtg-stats-')), 'stats.db');
}

test('resultsFor lists the games a device played, marking only its own seat', () => {
  const store = openStatsStore(':memory:');
  store.record(result('hearts/1#1', [A, B]));
  store.record(result('hearts/2#1', [C, undefined]));
  const games = store.resultsFor(A);
  assert.ok(Array.isArray(games));
  assert.equal(games.length, 1);
  assert.deepEqual(games[0].players.map(p => p.you), [true, false]);
  assert.equal(games[0].players[1].name, 'P1');
  assert.equal(games[0].historyAvailable, false);
  assert.deepEqual(store.resultsFor(hashDeviceId('d'.repeat(32)) as string), []);
});

test('a pass-and-play device is you in each of its seats', () => {
  const store = openStatsStore(':memory:');
  store.record(result('hearts/1#1', [A, A]));
  const games = store.resultsFor(A);
  assert.ok(Array.isArray(games));
  assert.deepEqual(games[0].players.map(p => p.you), [true, true]);
});

test('recording is idempotent and skips abandoned and moveless games', () => {
  const store = openStatsStore(':memory:');
  store.record(result('hearts/1#1', [A, B]));
  store.record(result('hearts/1#1', [A, B]));
  store.record(result('hearts/2#1', [A, B], { moveCount: 0 }));
  store.record(result('hearts/3#1', [A, B], { abandoned: true }));
  assert.equal((store.resultsFor(A) as unknown[]).length, 1);
});

test('a game with no device on any seat records nothing', () => {
  const file = tempFile();
  openStatsStore(file).record(result('hearts/9#1', [undefined, undefined]));
  assert.equal(new DatabaseSync(file).prepare('SELECT COUNT(*) AS n FROM results').get()?.n, 0);
});

test('clear turns a device into Former player and blocks later records', () => {
  const store = openStatsStore(':memory:');
  store.record(result('hearts/1#1', [A, B]));
  store.record(result('hearts/2#1', [A, A]));
  assert.deepEqual(store.clear(A), { games: 2, devices: 1 });
  const games = store.resultsFor(B);
  assert.ok(Array.isArray(games));
  assert.equal(games.length, 1);
  assert.deepEqual(games[0].players.map(p => [p.name, p.you]), [['Former player', false], ['P1', true]]);
  assert.equal(store.resultsFor(A), 'cleared');
  store.record(result('hearts/3#1', [A, B]));
  const after = store.resultsFor(B);
  assert.ok(Array.isArray(after));
  assert.equal(after.find(g => g.archiveId === 'hearts/3#1')?.players[0].name, 'Former player');
});

test('link merges the devices of two people, and the raw IDs are never stored', () => {
  const file = tempFile();
  const store = openStatsStore(file);
  store.record(result('hearts/1#1', [A, B]));
  store.record(result('hearts/2#1', [B, C]));
  assert.deepEqual(store.link(B, A), { games: 2 });
  assert.deepEqual(store.resultsFor(B), store.resultsFor(A));
  assert.equal(store.deviceCount(A), 2);
  assert.ok(store.samePerson(A, [B]));
  assert.ok(!store.samePerson(A, [C]));
  assert.deepEqual(store.link(A, A), { error: 'This device is already linked' });
  assert.deepEqual(store.link(B, A), { error: 'This device is already linked' });

  const db = new DatabaseSync(file);
  const dump = ['people', 'devices', 'cleared_devices', 'results', 'result_players']
    .map(table => JSON.stringify(db.prepare(`SELECT * FROM ${table}`).all())).join('\n');
  for (const raw of Object.values(RAW)) assert.ok(!dump.includes(raw));

  assert.deepEqual(store.clear(B), { games: 2, devices: 2 });
  assert.equal(store.resultsFor(A), 'cleared');
});

test('a device with no games can still be linked', () => {
  const store = openStatsStore(':memory:');
  store.record(result('hearts/1#1', [A, B]));
  assert.deepEqual(store.link(C, A), { games: 0 });
  assert.equal(store.deviceCount(A), 2);
});
