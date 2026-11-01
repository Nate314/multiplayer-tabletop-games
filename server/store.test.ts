import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openGameStore, type ArchivedGame } from './store.ts';
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

function archived(gameId: string, n: number, finishedAt = 1000): ArchivedGame {
  const state = started(`final ${n}`);
  return {
    id: `test/${gameId}#${n}`, gameType: 'test', gameId, n, finishedAt,
    state, history: [started('before')], timeline: [state]
  };
}

test('an archived game loads back as it was saved', () => {
  const store = openGameStore(':memory:');
  const game = archived('g1', 1);
  store.archive(game);
  assert.deepEqual(store.loadArchive(game.id), game);
  assert.equal(store.loadArchive('test/g1#2'), undefined);
});

test('archiving the same id again replaces it', () => {
  const store = openGameStore(':memory:');
  store.archive(archived('g1', 1));
  const again = { ...archived('g1', 1), finishedAt: 2000, state: started('replaced') };
  store.archive(again);
  assert.deepEqual(store.loadArchive(again.id), again);
});

test('nextGameNumber is 1 for a new game and one past the highest archived n', () => {
  const store = openGameStore(':memory:');
  assert.equal(store.nextGameNumber('test', 'g1'), 1);
  store.archive(archived('g1', 1));
  store.archive(archived('g1', 3));
  assert.equal(store.nextGameNumber('test', 'g1'), 4);
  assert.equal(store.nextGameNumber('test', 'g2'), 1);
});

test('pruneArchive removes only games finished before the cutoff', () => {
  const store = openGameStore(':memory:');
  store.archive(archived('g1', 1, 100));
  store.archive(archived('g1', 2, 200));
  assert.equal(store.pruneArchive(200), 1);
  assert.equal(store.loadArchive('test/g1#1'), undefined);
  assert.notEqual(store.loadArchive('test/g1#2'), undefined);
});

test('an archive whose data does not parse loads as undefined and is logged', (t: TestContext) => {
  const error = t.mock.method(console, 'error', () => {});
  const file = path.join(tempFolder(), 'games.sqlite');
  const store = openGameStore(file);
  store.archive(archived('g1', 1));
  store.archive(archived('g1', 2));
  const db = new DatabaseSync(file);
  db.prepare("UPDATE archived_games SET data = 'not json' WHERE n = 1").run();
  db.prepare("UPDATE archived_games SET data = '{\"state\":1,\"history\":[],\"timeline\":[]}' WHERE n = 2").run();
  db.close();
  assert.equal(store.loadArchive('test/g1#1'), undefined);
  assert.equal(store.loadArchive('test/g1#2'), undefined);
  assert.equal(error.mock.callCount(), 2);
});

test('removing a room keeps its archive', () => {
  const store = openGameStore(':memory:');
  store.save('test/g1', 'test', started('live'));
  store.archive(archived('g1', 1));
  store.remove('test/g1');
  assert.notEqual(store.loadArchive('test/g1#1'), undefined);
});

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 4, 5, 6]);
const IMAGE = '0123456789abcdef0123456789abcdef';
const OTHER = 'fedcba9876543210fedcba9876543210';

test('an image loads back with its mime, and saving its id again changes nothing', () => {
  const store = openGameStore(':memory:');
  store.saveImage(IMAGE, 'test/g1', 'image/jpeg', JPEG);
  store.saveImage(IMAGE, 'test/g2', 'image/png', PNG);
  assert.deepEqual(store.loadImage(IMAGE), { mime: 'image/jpeg', bytes: JPEG });
  assert.equal(store.loadImage(OTHER), undefined);
  store.deleteRoomImages('test/g2');
  assert.ok(store.loadImage(IMAGE), 'the second save did not move it to another room');
});

test("deleting a room's images keeps those an archived game shows, until the archive is pruned", () => {
  const store = openGameStore(':memory:');
  store.saveImage(IMAGE, 'test/g1', 'image/jpeg', JPEG);
  store.saveImage(OTHER, 'test/g1', 'image/png', PNG);
  store.saveImage('a'.repeat(32), 'test/g2', 'image/png', PNG);
  store.archive(archived('g1', 1, 100), [IMAGE]);
  store.deleteRoomImages('test/g1');
  assert.ok(store.loadImage(IMAGE));
  assert.equal(store.loadImage(OTHER), undefined);
  store.pruneArchive(200);
  assert.equal(store.loadImage(IMAGE), undefined);
  assert.ok(store.loadImage('a'.repeat(32)), 'a live room keeps its images through a prune');
});

test("countRoomImages counts only the room's own images", () => {
  const store = openGameStore(':memory:');
  assert.equal(store.countRoomImages('test/g1'), 0);
  store.saveImage(IMAGE, 'test/g1', 'image/jpeg', JPEG);
  store.saveImage(OTHER, 'test/g1', 'image/png', PNG);
  store.saveImage('a'.repeat(32), 'test/g2', 'image/png', PNG);
  assert.equal(store.countRoomImages('test/g1'), 2);
  store.deleteRoomImages('test/g1');
  assert.equal(store.countRoomImages('test/g1'), 0);
  assert.equal(store.countRoomImages('test/g2'), 1);
});

test('pruning an archive keeps an image a live room still has', () => {
  const store = openGameStore(':memory:');
  store.saveImage(IMAGE, 'test/g1', 'image/jpeg', JPEG);
  store.archive(archived('g1', 1, 100), [IMAGE]);
  store.pruneArchive(200);
  assert.ok(store.loadImage(IMAGE));
});

test('archiving a game again replaces the images it shows', () => {
  const store = openGameStore(':memory:');
  store.saveImage(IMAGE, 'test/g1', 'image/jpeg', JPEG);
  store.archive(archived('g1', 1), [IMAGE]);
  store.archive(archived('g1', 1), []);
  store.deleteRoomImages('test/g1');
  assert.equal(store.loadImage(IMAGE), undefined);
});

test('on load, the images of a room that was not saved (a lobby) are deleted', () => {
  const file = path.join(tempFolder(), 'games.sqlite');
  const store = openGameStore(file);
  store.save('test/g1', 'test', started('live'));
  store.saveImage(IMAGE, 'test/g1', 'image/jpeg', JPEG);
  store.saveImage(OTHER, 'test/lobby', 'image/png', PNG);
  const reopened = openGameStore(file);
  reopened.loadAll();
  assert.ok(reopened.loadImage(IMAGE));
  assert.equal(reopened.loadImage(OTHER), undefined);
});
