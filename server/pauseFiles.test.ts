import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/registry.ts';
import { dealt, type Loose } from '../games/testStates.ts';
import { PAUSE_FILE_FORMAT, parsePauseFile } from '../shared/pauseFile.ts';
import { buildPauseFile, canonicalJson, pausePlainParts, sealedRoomOf } from './pauseFiles.ts';
import { sealRoom } from './pauseSeal.ts';
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
    const secretJson = secret === undefined || secret === null ? null : JSON.stringify(secret);
    for (const seat of room.state.activePlayers) {
      const file = buildPauseFile(game, sealed, seat, { seal, shares }, new Date(0));
      const plain = JSON.stringify({ ...file, seal: null, share: null });
      assert.ok(!plain.includes('key-one') && !plain.includes('key-two'));
      if (secretJson && secretJson.length > 2) assert.ok(!plain.includes(secretJson), 'secret state leaked');
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
