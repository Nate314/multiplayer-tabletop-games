import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { serveClient } from './static.ts';

// A stand-in for dist/: the app shell, the worker, the manifest and one hashed asset
const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'));
fs.mkdirSync(path.join(dist, 'assets'));
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>app</title>');
fs.writeFileSync(path.join(dist, 'sw.js'), '// worker');
fs.writeFileSync(path.join(dist, 'manifest.webmanifest'), '{}');
fs.writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), '// app');

const app = express();
serveClient(app, dist);
const server = app.listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
after(() => {
  server.close();
  fs.rmSync(dist, { recursive: true, force: true });
});

test('hashed assets are kept for a year', async () => {
  const response = await fetch(`${base}/assets/index-abc123.js`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
});

test('the app shell, the worker and the manifest are checked on every load', async () => {
  for (const [url, type] of [['/', 'text/html'], ['/sw.js', 'javascript'], ['/manifest.webmanifest', 'application/manifest+json']]) {
    const response = await fetch(base + url);
    assert.equal(response.status, 200, url);
    assert.equal(response.headers.get('cache-control'), 'no-cache', url);
    assert.ok(response.headers.get('content-type')?.includes(type), url);
  }
});

test('a route without an extension gets the app shell', async () => {
  const response = await fetch(`${base}/some/game/route`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-cache');
  assert.match(await response.text(), /<title>app<\/title>/);
});

test('a missing file is a 404, not the app shell', async () => {
  const response = await fetch(`${base}/missing.js`);
  assert.equal(response.status, 404);
});
