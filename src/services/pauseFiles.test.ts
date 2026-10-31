import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPauseFile } from './pauseFiles.ts';
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

test('fetchPauseFile returns the file, and null when the request fails', async (t) => {
  const file = { format: 'multiplayer-tabletop-games-pause', seat: 1 };
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json(file));
  assert.deepEqual(await fetchPauseFile('uno', 'g', 1), file);
  fetchMock.mock.mockImplementation(async () => { throw new TypeError('offline'); });
  assert.equal(await fetchPauseFile('uno', 'g', 1), null);
});
