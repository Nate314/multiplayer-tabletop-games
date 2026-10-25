import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'fs';
import path from 'path';
import type { AddressInfo } from 'net';
import { mountRulesRoute } from './rules.ts';

const gamesDir = path.join(import.meta.dirname, '../games');
const app = express();
mountRulesRoute(app, gamesDir, ['chess']);
const server = app.listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
after(() => server.close());

test('a game README is served as markdown, checked on every load', async () => {
  const response = await fetch(`${base}/api/rules/chess`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-cache');
  assert.equal(await response.text(), fs.readFileSync(path.join(gamesDir, 'chess', 'README.md'), 'utf8'));
});

test('only games in the registry are served', async () => {
  for (const id of ['nope', '..%2Fpackage.json', 'checkers']) {
    assert.equal((await fetch(`${base}/api/rules/${id}`)).status, 404, id);
  }
});
