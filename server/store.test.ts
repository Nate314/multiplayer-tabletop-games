import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openGameStore, type SavedRoom } from './store.ts';
import { testGame } from '../shared/testGame.ts';

function savedRoom(gameStatus: string): SavedRoom {
  const start = testGame.createGameState('g1');
  const state = { ...start, started: true, gameStatus };
  return { gameType: 'test', state, history: [start], timeline: [state] };
}

function tempFolder(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mtg-'));
}

test('saves, loads, overwrites and removes rooms', () => {
  const store = openGameStore(':memory:');
  const first = savedRoom('first');
  store.save('test/g1', first);
  assert.deepEqual(store.loadAll(), new Map([['test/g1', first]]));

  const second = savedRoom('second');
  store.save('test/g1', second);
  assert.deepEqual(store.loadAll(), new Map([['test/g1', second]]));

  store.remove('test/g1');
  assert.equal(store.loadAll().size, 0);
});

test('a row that does not parse or has the wrong shape is skipped and deleted', (t: TestContext) => {
  t.mock.method(console, 'error', () => {});
  const file = path.join(tempFolder(), 'games.sqlite');
  openGameStore(file).save('test/g1', savedRoom('kept'));

  const db = new DatabaseSync(file);
  const insert = db.prepare('INSERT INTO rooms (id, game_type, data) VALUES (?, ?, ?)');
  insert.run('test/bad', 'test', '{nope');
  insert.run('test/empty', 'test', '{}');
  insert.run('test/flat', 'test', '{"state":{},"history":{},"timeline":[]}');
  db.close();

  const store = openGameStore(file);
  assert.deepEqual([...store.loadAll().keys()], ['test/g1']);
  assert.deepEqual([...store.loadAll().keys()], ['test/g1']);
  assert.deepEqual(new DatabaseSync(file).prepare('SELECT id FROM rooms').all().map(row => row.id), ['test/g1']);
});

test('creates the folder for a new database file', () => {
  const folder = path.join(tempFolder(), 'nested');
  openGameStore(path.join(folder, 'games.sqlite'));
  assert.ok(fs.existsSync(folder));
});
