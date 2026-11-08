import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { normalize } from '../../shared/guess.ts';
import { lettersFor } from './options.ts';
import { POOL } from './pool.ts';

test('the pool has at least 150 categories, none repeated', () => {
  assert.ok(POOL.length >= 150, `only ${POOL.length}`);
  assert.equal(new Set(POOL.map(normalize)).size, POOL.length);
});

test('every category is a short plain phrase', () => {
  for (const c of POOL) {
    assert.ok(c.length >= 3 && c.length <= 40, c);
    assert.match(c, /^[A-Z][A-Za-z ,'-]*$/);
  }
});

test('lettersFor leaves out the hard letters unless asked', () => {
  assert.equal(lettersFor(false).length, 20);
  assert.ok(lettersFor(false).every((l) => !'QUVXYZ'.includes(l)));
  assert.equal(lettersFor(true).length, 26);
});

test('no client file imports rules.ts or pool.ts', () => {
  const dir = path.join(import.meta.dirname, 'client');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true, encoding: 'utf8' }) : [];
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) continue;
    assert.doesNotMatch(fs.readFileSync(full, 'utf8'), /from '\.\.\/(rules|pool)\.ts'/, file);
  }
});

test('no file of the game names a commercial game', () => {
  const files = fs.readdirSync(import.meta.dirname, { recursive: true, encoding: 'utf8' })
    .map((f) => path.join(import.meta.dirname, f));
  const spec = path.join(import.meta.dirname, '..', '..', 'e2e', 'categories.spec.ts');
  if (fs.existsSync(spec)) files.push(spec);
  for (const full of files) {
    if (fs.statSync(full).isDirectory() || full.endsWith('pool.test.ts')) continue;
    assert.doesNotMatch(fs.readFileSync(full, 'utf8'), /scattergories/i, full);
  }
});
