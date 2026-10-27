import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'net';
import { mountAssetRoutes } from './routes.ts';
import type { SvgAsset } from './registry.ts';
import type { SoundDef } from '../../shared/sounds.ts';

const testDot: SvgAsset = {
  name: 'test-dot',
  params: ['color'],
  samples: [['red'], ['blue']],
  render: ([color]) => (color === 'red' || color === 'blue' ? `<svg><circle fill="${color}"/></svg>` : null),
};

const app = express();
mountAssetRoutes(app, [testDot]);
const server = app.listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
after(() => server.close());

test('a generated svg is served as an immutable svg', async () => {
  const response = await fetch(`${base}/api/svg/test-dot/red`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^image\/svg\+xml/);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.match(await response.text(), /^<svg/);
});

test('an unknown asset is a 404', async () => {
  assert.equal((await fetch(`${base}/api/svg/nope`)).status, 404);
  assert.equal((await fetch(`${base}/api/svg/nope/red`)).status, 404);
});

test('a parameter the asset refuses is a 400', async () => {
  assert.equal((await fetch(`${base}/api/svg/test-dot/green`)).status, 400);
  assert.equal((await fetch(`${base}/api/svg/test-dot`)).status, 400);
  assert.equal((await fetch(`${base}/api/svg/test-dot/red/extra`)).status, 400);
});

test('the listing names every asset with its samples', async () => {
  const response = await fetch(`${base}/api/svg`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{ name: 'test-dot', params: ['color'], samples: [['red'], ['blue']] }]);
});

test('the sound listing has every sound with its notes', async () => {
  const sounds = (await (await fetch(`${base}/api/sound`)).json()) as SoundDef[];
  assert.equal(sounds.length, 6);
  const turn = sounds.find(sound => sound.name === 'turn');
  assert.deepEqual(turn?.notes, [{ at: 0, length: 0.25, hz: 660, type: 'sine' }, { at: 0.15, length: 0.35, hz: 880, type: 'sine' }]);
});

test('one sound by name, or a 404', async () => {
  const dice = (await (await fetch(`${base}/api/sound/dice`)).json()) as SoundDef;
  assert.equal(dice.noise?.bursts, 6);
  assert.equal((await fetch(`${base}/api/sound/nope`)).status, 404);
});

test('the qr asset draws a link and refuses text that does not fit', async () => {
  const real = express();
  mountAssetRoutes(real);
  const realServer = real.listen(0);
  try {
    const url = `http://localhost:${(realServer.address() as AddressInfo).port}/api/svg/qr/`;
    const ok = await fetch(url + encodeURIComponent('https://x.example/join/chess/a%2Eb'));
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('content-type') ?? '', /^image\/svg\+xml/);
    assert.equal((await fetch(url + 'a'.repeat(300))).status, 400);
  } finally {
    realServer.close();
  }
});
