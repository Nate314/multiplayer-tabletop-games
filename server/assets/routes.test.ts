import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'net';
import { mountAssetRoutes } from './routes.ts';
import type { SvgAsset } from './registry.ts';

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
});

test('the listing names every asset with its samples', async () => {
  const response = await fetch(`${base}/api/svg`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{ name: 'test-dot', params: ['color'], samples: [['red'], ['blue']] }]);
});
