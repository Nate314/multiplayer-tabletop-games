import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPauseFile, fetchResumeStatus, sessionForResume, uploadPauseFile } from './pauseFiles.ts';
import type { PauseFile, ResumeUpload } from '../../shared/pauseFile.ts';
import { deviceId } from './device.ts';

test('fetchPauseFile sends the device ID and returns null on a 404', async (t) => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response('{"error":"Not available"}', { status: 404 });
  });
  assert.equal(await fetchPauseFile('uno', 'fri day/#1', 2), null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/pause-file/uno/fri%20day%2F%231/2');
  assert.deepEqual(calls[0].init?.headers, { Authorization: `Bearer ${deviceId()}` });
});

test('fetchPauseFile sends the seat key when there is one', async (t) => {
  const calls: (RequestInit | undefined)[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, init?: RequestInit) => {
    calls.push(init);
    return new Response('{"error":"Not available"}', { status: 404 });
  });
  await fetchPauseFile('uno', 'g', 2, 'seat-key-2');
  assert.deepEqual(calls[0]?.headers, { Authorization: 'Bearer seat-key-2' });
});

test('fetchPauseFile returns the file, and null when the request fails', async (t) => {
  const file = { format: 'multiplayer-tabletop-games-pause', seat: 1 };
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json(file));
  assert.deepEqual(await fetchPauseFile('uno', 'g', 1), file);
  fetchMock.mock.mockImplementation(async () => { throw new TypeError('offline'); });
  assert.equal(await fetchPauseFile('uno', 'g', 1), null);
});

const upload = (seat: number, playerName: string, seatKey: string): ResumeUpload => ({
  gameType: 'uno', gameId: 'g1', players: [], ready: false, error: null, seat, seatKey, playerName
});

test('sessionForResume rejoins one upload as a player', () => {
  assert.deepEqual(sessionForResume([upload(2, 'Bob', 'k2')]), {
    gameType: 'uno', gameId: 'g1', playerName: 'Bob', seatKey: 'k2', inGame: true
  });
});

test('sessionForResume rejoins several uploads as pass and play, in seat order', () => {
  assert.deepEqual(sessionForResume([upload(2, 'Bob', 'k2'), upload(1, 'Alice', 'k1')]), {
    gameType: 'uno', gameId: 'g1', playerName: 'Alice', role: 'passAndPlay', inGame: true,
    localSeats: [{ playerName: 'Alice', seatKey: 'k1' }, { playerName: 'Bob', seatKey: 'k2' }]
  });
});

test('uploadPauseFile posts the file with the device ID and copes with any answer', async (t) => {
  const file = { format: 'multiplayer-tabletop-games-pause' } as unknown as PauseFile;
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Response.json(upload(1, 'Alice', 'k1'));
  });
  assert.deepEqual(await uploadPauseFile(file), upload(1, 'Alice', 'k1'));
  assert.equal(calls[0].url, '/api/resume');
  assert.equal(calls[0].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { file, deviceId: deviceId() });
  fetchMock.mock.mockImplementation(async () => Response.json({ error: "Bob's file is already in" }, { status: 400 }));
  assert.deepEqual(await uploadPauseFile(file), { error: "Bob's file is already in" });
  // express answers broken JSON and an oversized body with its own page
  fetchMock.mock.mockImplementation(async () => new Response('<html>Payload Too Large</html>', { status: 413 }));
  assert.deepEqual(await uploadPauseFile(file), { error: 'This file is not a pause file' });
  fetchMock.mock.mockImplementation(async () => { throw new TypeError('offline'); });
  assert.deepEqual(await uploadPauseFile(file), { error: 'Could not reach the server' });
});

test('fetchResumeStatus sends the seat key and returns null on a 404', async (t) => {
  const status = upload(1, 'Alice', 'k1');
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Response.json(status);
  });
  assert.deepEqual(await fetchResumeStatus('uno', 'fri day', 'k1'), status);
  assert.equal(calls[0].url, '/api/resume/uno/fri%20day');
  assert.deepEqual(calls[0].init?.headers, { Authorization: 'Bearer k1' });
  fetchMock.mock.mockImplementation(async () => Response.json({ error: 'Not available' }, { status: 404 }));
  assert.equal(await fetchResumeStatus('uno', 'g1', 'k1'), null);
});
