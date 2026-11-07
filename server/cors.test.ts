import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'net';
import { allowCrossOrigin } from './cors.ts';

const app = express();
allowCrossOrigin(app);
app.get('/api/thing', (_req, res) => { res.json({ ok: true }); });
app.get('/page', (_req, res) => { res.send('page'); });
const server = app.listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
after(() => server.close());

test('API answers carry the cross-origin header', async () => {
  const response = await fetch(`${base}/api/thing`, { headers: { Origin: 'https://example.github.io' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
});

test('a preflight is answered without reaching the routes', async () => {
  const response = await fetch(`${base}/api/thing`, { method: 'OPTIONS' });
  assert.equal(response.status, 204);
  assert.match(response.headers.get('access-control-allow-headers') ?? '', /Authorization/);
});

test('pages outside the API are left alone', async () => {
  const response = await fetch(`${base}/page`);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});
