import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openGameStore } from './store.ts';
import { testGame } from '../shared/testGame.ts';
import type { BaseGameState } from '../shared/types.ts';

function started(gameStatus: string): BaseGameState {
  return { ...testGame.createGameState('g1'), started: true, gameStatus };
}

function count(file: string, table: string): number {
  return Number(new DatabaseSync(file).prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n);
}

function tempFolder(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mtg-'));
}

test('saves, loads, overwrites and removes rooms', () => {
  const store = openGameStore(':memory:');
  const first = started('first');
  store.save('test/g1', 'test', first);
  assert.deepEqual(store.loadAll(), new Map([['test/g1', { gameType: 'test', state: first, history: [], timeline: [] }]]));

  const second = started('second');
  store.save('test/g1', 'test', second);
  assert.deepEqual(store.loadAll().get('test/g1')?.state, second);

  store.remove('test/g1');
  assert.equal(store.loadAll().size, 0);
});

test('a push adds one step, a pop removes the last, and history and timeline load in order', () => {
  const file = path.join(tempFolder(), 'games.sqlite');
  const store = openGameStore(file);
  const states = [0, 1, 2, 3].map(move => started(`move ${move}`));
  for (let index = 0; index < 3; index++) {
    store.save('test/g1', 'test', states[index + 1], { type: 'push', index, before: states[index], after: states[index + 1] });
    assert.equal(count(file, 'room_steps'), index + 1);
  }
  assert.deepEqual(store.loadAll().get('test/g1'), {
    gameType: 'test', state: states[3], history: states.slice(0, 3), timeline: states.slice(1)
  });

  store.save('test/g1', 'test', states[2], { type: 'pop', index: 2 });
  assert.deepEqual(store.loadAll().get('test/g1')?.timeline, states.slice(1, 3));
  assert.equal(count(file, 'room_steps'), 2);

  store.remove('test/g1');
  assert.equal(count(file, 'rooms'), 0);
  assert.equal(count(file, 'room_steps'), 0);
});

test('a room whose state or steps do not parse, have the wrong shape or skip an index is deleted with its steps', (t: TestContext) => {
  t.mock.method(console, 'error', () => {});
  const file = path.join(tempFolder(), 'games.sqlite');
  const state = JSON.stringify(started('kept'));
  openGameStore(file).save('test/g1', 'test', started('kept'), { type: 'push', index: 0, before: started('a'), after: started('b') });

  const db = new DatabaseSync(file);
  const insert = db.prepare('INSERT INTO rooms (id, game_type, data) VALUES (?, ?, ?)');
  const insertStep = db.prepare('INSERT INTO room_steps (room_id, idx, before, after) VALUES (?, ?, ?, ?)');
  insert.run('test/bad', 'test', '{nope');
  insert.run('test/null', 'test', 'null');
  insert.run('test/list', 'test', '[]');
  insert.run('test/badStep', 'test', state);
  insertStep.run('test/badStep', 0, state, '{nope');
  insert.run('test/gap', 'test', state);
  insertStep.run('test/gap', 1, state, state);
  insertStep.run('test/orphan', 0, state, state);
  db.close();

  const store = openGameStore(file);
  assert.deepEqual([...store.loadAll().keys()], ['test/g1']);
  assert.deepEqual([...store.loadAll().keys()], ['test/g1']);
  const check = new DatabaseSync(file);
  assert.deepEqual(check.prepare('SELECT id FROM rooms').all().map(row => row.id), ['test/g1']);
  assert.deepEqual(check.prepare('SELECT DISTINCT room_id FROM room_steps').all().map(row => row.room_id), ['test/g1']);
});

test('creates the folder for a new database file', () => {
  const folder = path.join(tempFolder(), 'nested');
  openGameStore(path.join(folder, 'games.sqlite'));
  assert.ok(fs.existsSync(folder));
});
