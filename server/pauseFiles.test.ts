import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/registry.ts';
import { dealt, type Loose } from '../games/testStates.ts';
import { PAUSE_FILE_FORMAT, parsePauseFile, type PauseFile } from '../shared/pauseFile.ts';
import { handGame } from '../shared/testGame.ts';
import { buildPauseFile, canonicalJson, checkPauseFiles, pausePlainParts, sealedRoomOf } from './pauseFiles.ts';
import { createGameManager } from './games.ts';
import { openSeal, sealRoom, type SealedRoom } from './pauseSeal.ts';
import { rememberingKeys } from './testing.ts';
import type { ViewRoom } from './views.ts';

function pausedRoom(game: (typeof GAMES)[number]): ViewRoom {
  const dealtState = dealt(game);
  const state: Loose = {
    ...dealtState, started: true, paused: true, seatKeys: { 1: 'key-one', 2: 'key-two' },
    pause: { seal: { iv: '', tag: '', data: '', fingerprint: '', shareHashes: {} }, shares: { 1: 'share-one', 2: 'share-two' } }
  };
  const before = { ...dealtState, started: true, seatKeys: { 1: 'key-one', 2: 'key-two' } };
  return { game, state, history: [before], timeline: [state] };
}

for (const game of GAMES) {
  const id = game.info.id;

  test(`${id}: a pause file's plain parts show no secret and no other seat's hand`, () => {
    const room = pausedRoom(game);
    const sealed = sealedRoomOf(room);
    const { seal, shares } = sealRoom(sealed, room.state.activePlayers);
    const secret = game.secretState?.(room.state);
    // each field on its own: a leak sits inside a larger object, where the whole secret's JSON would not match
    const secretFields = secret !== null && typeof secret === 'object' ? Object.values(secret) : [];
    const secretJsons = secretFields.map(field => JSON.stringify(field)).filter(json => json !== undefined && json.length >= 12);
    for (const seat of room.state.activePlayers) {
      const file = buildPauseFile(game, sealed, seat, { seal, shares }, new Date(0));
      const plain = JSON.stringify({ ...file, seal: null, share: null });
      assert.ok(!plain.includes('key-one') && !plain.includes('key-two'));
      for (const json of secretJsons) assert.ok(!plain.includes(json), `secret state leaked: ${json.slice(0, 40)}`);
      const own = JSON.stringify(game.privateSeatView?.(room.state, seat) ?? null);
      for (const other of room.state.activePlayers.filter(candidate => candidate !== seat)) {
        const hand = JSON.stringify(game.privateSeatView?.(room.state, other) ?? null);
        // a hand equal to the seat's own (a freshly dealt splendor board) shows nothing the seat lacks
        if (hand.length >= 12 && hand !== own) assert.ok(!plain.includes(hand), `seat ${other}'s hand leaked`);
      }
      assert.deepEqual(parsePauseFile(JSON.stringify(file), [id]), { file: JSON.parse(JSON.stringify(file)) });
      assert.equal(file.format, PAUSE_FILE_FORMAT);
    }
  });

  test(`${id}: the plain hand is the seat's own private view`, () => {
    const room = pausedRoom(game);
    for (const seat of room.state.activePlayers) {
      const { hand } = pausePlainParts(game, sealedRoomOf(room), seat);
      assert.deepEqual(hand, game.privateSeatView?.(room.state, seat) ?? null);
    }
  });
}

test('sealedRoomOf strips keys from history entries too', () => {
  const sealed = sealedRoomOf(pausedRoom(GAMES[0]));
  for (const entry of [sealed.state, ...sealed.history, ...sealed.timeline]) {
    for (const key of ['seatKeys', 'pause', 'seatDevices', 'spectatorKeys']) assert.ok(!(key in entry), key);
  }
});

test('canonicalJson sorts keys at every depth and drops undefined', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [{ z: 1, y: undefined, x: 2 }], c: null } }), '{"a":{"c":null,"d":[{"x":2,"z":1}]},"b":1}');
  assert.equal(canonicalJson({ a: 1, b: 2 }), canonicalJson({ b: 2, a: 1 }));
});

// A handGame room paused after Alice's first tick, with every seat's file
function pausedFiles(names: string[]) {
  const manager = rememberingKeys(createGameManager([handGame], () => 0.5));
  for (const name of names) manager.join('test', 'g1', name);
  const assertOk = (result: object) => assert.ok(!('error' in result), JSON.stringify(result));
  assertOk(manager.move('test/g1', 1, { type: 'tick' }));
  assertOk(manager.requestPause('test/g1', 1));
  for (const seat of names.keys()) if (seat > 0) assertOk(manager.votePause('test/g1', seat + 1, true));
  const state = manager.rawState('test/g1')!;
  const files = names.map((_name, index) => {
    const result = manager.pauseFile('test', 'g1', index + 1, state.seatKeys![index + 1], new Date(0));
    if ('error' in result) assert.fail(result.error);
    return JSON.parse(JSON.stringify(result.file)) as PauseFile;
  });
  return { state, files };
}

const changedTable = (file: PauseFile): PauseFile => ({ ...file, table: { ...file.table, gameStatus: 'Alice won' } });

test('three good files open the room', () => {
  const { state, files } = pausedFiles(['Alice', 'Bob', 'Cara']);
  const result = checkPauseFiles(handGame, files);
  assert.ok('room' in result, JSON.stringify(result));
  assert.deepEqual(result.room, openSeal(state.pause!.seal, state.pause!.shares));
  assert.deepEqual(result.room.state, sealedRoomOf({ game: handGame, state, history: [], timeline: [] }).state);
});

test('a changed hand names its seat', () => {
  const { files } = pausedFiles(['Alice', 'Bob', 'Cara']);
  files[2] = { ...files[2], hand: 'card1' };
  assert.deepEqual(checkPauseFiles(handGame, files), { error: "Cara's pause file does not match the others", seats: [3] });
});

test('a changed table names the odd file out', () => {
  const { files } = pausedFiles(['Alice', 'Bob', 'Cara']);
  files[1] = changedTable(files[1]);
  assert.deepEqual(checkPauseFiles(handGame, files), { error: "Bob's pause file does not match the others", seats: [2] });
});

test('a swapped share names its seat', () => {
  const { files } = pausedFiles(['Alice', 'Bob', 'Cara']);
  files[1] = { ...files[1], share: files[0].share };
  assert.deepEqual(checkPauseFiles(handGame, files), { error: "Bob's pause file does not match the others", seats: [2] });
});

test('two files that disagree name both', () => {
  const { files } = pausedFiles(['Alice', 'Bob']);
  files[1] = changedTable(files[1]);
  assert.deepEqual(checkPauseFiles(handGame, files), { error: 'The pause files from Alice and Bob do not match', seats: [1, 2] });
});

test('files that agree on a lie are refused', () => {
  const { files } = pausedFiles(['Alice', 'Bob', 'Cara']);
  assert.deepEqual(
    checkPauseFiles(handGame, files.map(changedTable)),
    { error: 'The pause files from Alice, Bob and Cara do not match', seats: [1, 2, 3] }
  );
});

test('a room that opens but does not rebuild names every seat', () => {
  const { files } = pausedFiles(['Alice', 'Bob']);
  // only a table where every player colludes can seal a room like this
  const seal = sealRoom({ state: null, history: null, timeline: null } as never, [1, 2]);
  const forged = files.map(file => ({ ...file, seal: seal.seal, share: seal.shares[file.seat] }));
  assert.deepEqual(checkPauseFiles(handGame, forged), { error: 'The pause files from Alice and Bob do not match', seats: [1, 2] });
});

// A stranger's own key over a room of their making, with every plain part rebuilt from it so the files agree
function selfMade(files: PauseFile[], room: SealedRoom): PauseFile[] {
  const { seal, shares } = sealRoom(room, [1, 2]);
  return files.map(file => {
    let parts: Partial<PauseFile> = {};
    try {
      parts = pausePlainParts(handGame, room, file.seat);
    } catch { /* a room that cannot rebuild keeps the real parts */ }
    return JSON.parse(JSON.stringify({ ...file, ...parts, seal, share: shares[file.seat] })) as PauseFile;
  });
}

const EVERY_SEAT = { error: 'The pause files from Alice and Bob do not match', seats: [1, 2] };

test('a self-made room that is not a game is refused naming every seat', () => {
  const { files } = pausedFiles(['Alice', 'Bob']);
  const real = checkPauseFiles(handGame, files);
  assert.ok('room' in real);
  const notObjects = [
    { ...real.room, state: 'text' }, { ...real.room, state: [] },
    { ...real.room, history: {} }, { ...real.room, timeline: [] },
    { ...real.room, state: { ...real.room.state, activePlayers: [1, 2, 3] } },
    { ...real.room, state: { ...real.room.state, playerNames: { 1: 'Alice', 2: 'Eve' } } }
  ];
  for (const room of notObjects) assert.deepEqual(checkPauseFiles(handGame, selfMade(files, room as never)), EVERY_SEAT);
});

test('a self-made room for another game ID is refused naming every seat', () => {
  const { files } = pausedFiles(['Alice', 'Bob']);
  const real = checkPauseFiles(handGame, files);
  assert.ok('room' in real);
  const room = { ...real.room, state: { ...real.room.state, gameId: 'g2' } };
  assert.deepEqual(checkPauseFiles(handGame, selfMade(files, room)), EVERY_SEAT);
});
