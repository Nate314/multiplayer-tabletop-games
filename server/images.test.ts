import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'net';
import { createGameManager } from './games.ts';
import { mountImageRoutes, MAX_IMAGE_BYTES, MAX_ROOM_IMAGES } from './images.ts';
import { openGameStore, type GameStore } from './store.ts';
import { rememberingKeys } from './testing.ts';
import { testGame, type TestPublicState, type TestState } from '../shared/testGame.ts';
import type { GameDefinition } from '../shared/gameDefinition.ts';
import { asRecord } from '../shared/messages.ts';
import type { PauseFile } from '../shared/pauseFile.ts';
import type { Random, Result } from '../shared/types.ts';

type ImageState = TestState & { image?: string };

// testGame whose `picture` action shows an uploaded image
const imageGame: GameDefinition<ImageState, TestPublicState> = {
  ...(testGame as GameDefinition<ImageState, TestPublicState>),
  imagesOf: state => (state.image ? [state.image] : []),
  applyAction(state, seat, action, random, now): Result<ImageState> {
    const picture = asRecord(action);
    if (picture?.type === 'picture' && typeof picture.id === 'string') return { state: { ...state, image: picture.id } };
    return testGame.applyAction!(state, seat, action, random, now) as Result<ImageState>;
  }
};

const ROOM = 'test/g1';
const seededRandom: Random = () => 0.5;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('a small picture')]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('a png')]);

// A store that records every image it was asked to save, so a refusal can be shown to save nothing
function spiedStore(): { store: GameStore; saved: string[] } {
  const store = openGameStore(':memory:');
  const saved: string[] = [];
  return { store: { ...store, saveImage: (...args) => { saved.push(args[0]); store.saveImage(...args); } }, saved };
}

function managerOn(store: GameStore) {
  return rememberingKeys(createGameManager([imageGame], seededRandom, store));
}

const { store, saved } = spiedStore();
const manager = managerOn(store);
manager.join('test', 'g1', 'Alice'); // a lobby: nobody has moved yet
const aliceKey = manager.rawState(ROOM)?.seatKeys?.[1] as string;

const app = express();
mountImageRoutes(app, manager);
const server = app.listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
after(() => server.close());

function upload(body: Buffer | string, options: { key?: string; type?: string; gameId?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': options.type ?? 'image/jpeg' };
  const key = 'key' in options ? options.key : aliceKey;
  if (key !== undefined) headers['X-Seat-Key'] = key;
  return fetch(`${base}/api/images/test/${options.gameId ?? 'g1'}`, { method: 'POST', headers, body });
}

async function uploadedId(body: Buffer, type?: string): Promise<string> {
  const response = await upload(body, { type });
  assert.equal(response.status, 201);
  const { id } = await response.json() as { id: string };
  assert.match(id, /^[0-9a-f]{32}$/);
  return id;
}

async function refused(response: Response, status: number) {
  assert.equal(response.status, status);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  assert.equal(typeof (await response.json() as { error?: unknown }).error, 'string');
}

test("a seated player's JPEG comes back with the same bytes and mime", async () => {
  const id = await uploadedId(JPEG);
  const response = await fetch(`${base}/api/images/${id}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), JPEG);
});

test('a PNG is stored as a PNG', async () => {
  const id = await uploadedId(PNG, 'image/png');
  assert.equal((await fetch(`${base}/api/images/${id}`)).headers.get('content-type'), 'image/png');
});

test('every refused upload is a JSON 4xx and stores nothing', async () => {
  const before = saved.length;
  await refused(await upload(JPEG, { key: 'wrong' }), 403);
  await refused(await upload(JPEG, { key: undefined }), 403);
  await refused(await upload(JPEG, { gameId: 'nobody' }), 404);
  await refused(await upload(Buffer.concat([JPEG, Buffer.alloc(MAX_IMAGE_BYTES + 1 - JPEG.length)])), 413);
  await refused(await upload('just some text, renamed .jpg'), 415);
  await refused(await upload(JPEG, { type: 'text/plain' }), 415);
  await refused(await upload(Buffer.alloc(0)), 415);
  assert.equal(saved.length, before);
});

test('exactly 1 MB is accepted', async () => {
  await uploadedId(Buffer.concat([JPEG, Buffer.alloc(MAX_IMAGE_BYTES - JPEG.length)]));
});

test('a room holding MAX_ROOM_IMAGES pictures refuses another with a 429 and stores nothing', async () => {
  const { store: own, saved: ownSaved } = spiedStore();
  const other = managerOn(own);
  const capApp = express();
  mountImageRoutes(capApp, other);
  const capServer = capApp.listen(0);
  try {
    other.join('test', 'g3', 'Cat');
    const key = other.rawState('test/g3')?.seatKeys?.[1] as string;
    for (let i = 0; i < MAX_ROOM_IMAGES; i++) assert.ok('id' in other.uploadImage('test', 'g3', key, JPEG));
    const response = await fetch(`http://localhost:${(capServer.address() as AddressInfo).port}/api/images/test/g3`, {
      method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'X-Seat-Key': key }, body: JPEG
    });
    assert.equal(response.status, 429);
    assert.deepEqual(await response.json(), { error: 'This game has too many pictures' });
    assert.equal(ownSaved.length, MAX_ROOM_IMAGES);
    assert.equal(own.countRoomImages('test/g3'), MAX_ROOM_IMAGES);
  } finally {
    capServer.close();
  }
});

test('an unknown or malformed id is a 404', async () => {
  await refused(await fetch(`${base}/api/images/${'0'.repeat(32)}`), 404);
  await refused(await fetch(`${base}/api/images/not-an-id`), 404);
});

test("a room's images go when the room is deleted", async () => {
  const { store: own } = spiedStore();
  const other = managerOn(own);
  other.join('test', 'g2', 'Bob');
  const key = other.rawState('test/g2')?.seatKeys?.[1] as string;
  const result = other.uploadImage('test', 'g2', key, JPEG);
  assert.ok('id' in result);
  assert.ok(own.loadImage(result.id));
  other.removeRoom('test/g2');
  assert.equal(own.loadImage(result.id), undefined);

  const id = await uploadedId(JPEG);
  manager.removeRoom(ROOM);
  await refused(await fetch(`${base}/api/images/${id}`), 404);
});

// Alice and Bob in a room showing an uploaded picture, with Alice's key
function pictureTable(store: GameStore = openGameStore(':memory:')) {
  const table = managerOn(store);
  table.join('test', 'g1', 'Alice');
  table.join('test', 'g1', 'Bob');
  const alice = table.rawState(ROOM)?.seatKeys?.[1] as string;
  const bob = table.rawState(ROOM)?.seatKeys?.[2] as string;
  const uploaded = table.uploadImage('test', 'g1', alice, JPEG);
  if (!('id' in uploaded)) assert.fail(uploaded.error);
  for (const result of [table.action(ROOM, 1, { type: 'picture', id: uploaded.id }), table.move(ROOM, 1, { type: 'tick' })]) {
    if ('error' in result) assert.fail(result.error);
  }
  return { table, store, alice, bob, id: uploaded.id };
}

const embedded = (bytes: Buffer) => ({ mime: 'image/jpeg', data: bytes.toString('base64') });

test('a game file carries the images its steps show, and they outlive the room', () => {
  const { table, store, alice, id } = pictureTable();
  table.action(ROOM, 1, { type: 'concede' });
  const file = table.gameFile('test', 'g1', alice, new Date());
  if ('error' in file) assert.fail(file.error);
  assert.deepEqual(file.file.images, { [id]: embedded(JPEG) });
  table.removeRoom(ROOM);
  assert.ok(store.loadImage(id), 'the archived game still shows it');
});

function pausedFiles() {
  const picture = pictureTable();
  const { table, alice, bob } = picture;
  for (const result of [table.requestPause(ROOM, 1), table.votePause(ROOM, 2, true)]) if ('error' in result) assert.fail(result.error);
  const fileFor = (seat: number, key: string): PauseFile => {
    const result = table.pauseFile('test', 'g1', seat, key, new Date());
    if ('error' in result) assert.fail(result.error);
    return result.file;
  };
  return { ...picture, aliceFile: fileFor(1, alice), bobFile: fileFor(2, bob) };
}

function resume(store: GameStore, files: PauseFile[], meanwhile = () => {}) {
  const fresh = managerOn(store);
  meanwhile(); // after the start, which clears images of rooms it did not load
  for (const file of files) {
    const result = fresh.uploadPauseFile(file, undefined);
    if (!('seatKey' in result)) assert.fail(result.error);
  }
  assert.equal(fresh.rawState(ROOM)?.paused, true);
}

test('a pause file carries its images and a resume on another server stores them again', () => {
  const { aliceFile, bobFile, id } = pausedFiles();
  assert.deepEqual(aliceFile.images, { [id]: embedded(JPEG) });
  const other = openGameStore(':memory:');
  resume(other, [aliceFile, bobFile]);
  assert.deepEqual(other.loadImage(id), { mime: 'image/jpeg', bytes: JPEG });
});

test('files that disagree on an image are refused', () => {
  const { aliceFile, bobFile, id } = pausedFiles();
  const fresh = managerOn(openGameStore(':memory:'));
  fresh.uploadPauseFile(aliceFile, undefined);
  const result = fresh.uploadPauseFile({ ...bobFile, images: { [id]: embedded(PNG) } }, undefined);
  assert.ok(!('seatKey' in result));
  assert.equal(fresh.rawState(ROOM), undefined);
});

test('a resume never overwrites an image, and stores only valid images the game shows', () => {
  const { aliceFile, bobFile, id } = pausedFiles();
  const other = openGameStore(':memory:');
  const stranger = 'a'.repeat(32);
  const images = { ...aliceFile.images, [stranger]: embedded(JPEG) };
  resume(other, [{ ...aliceFile, images }, { ...bobFile, images }], () => other.saveImage(id, 'test/elsewhere', 'image/png', PNG));
  assert.deepEqual(other.loadImage(id), { mime: 'image/png', bytes: PNG });
  assert.equal(other.loadImage(stranger), undefined, 'no state shows it');
});

test('a resume skips an embedded image that is not a JPEG or PNG, or is too large', () => {
  for (const bytes of [Buffer.from('just text'), Buffer.concat([JPEG, Buffer.alloc(MAX_IMAGE_BYTES)])]) {
    const { aliceFile, bobFile, id } = pausedFiles();
    const other = openGameStore(':memory:');
    const images = { [id]: embedded(bytes) };
    resume(other, [{ ...aliceFile, images }, { ...bobFile, images }]);
    assert.equal(other.loadImage(id), undefined);
  }
});
