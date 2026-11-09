import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { normalize } from '../../shared/guess.ts';
import { PROMPTS } from './prompts.ts';

const dir = import.meta.dirname;
const filesIn = (root: string) => fs.existsSync(root)
  ? fs.readdirSync(root, { recursive: true, encoding: 'utf8' }).map(file => path.join(root, file)).filter(full => fs.statSync(full).isFile())
  : [];

test('every prompt is lowercase letters, single spaces or hyphens', () => {
  for (const prompt of PROMPTS) assert.match(prompt, /^[a-z]+([ -][a-z]+)*$/);
});

test('the list has at least 300 prompts and no two match each other', () => {
  assert.ok(PROMPTS.length >= 300, `only ${PROMPTS.length} prompts`);
  assert.equal(new Set(PROMPTS.map(normalize)).size, PROMPTS.length);
});

test('no client file imports rules.ts or prompts.ts', () => {
  for (const file of filesIn(path.join(dir, 'client'))) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /from '\.\.\/(rules|prompts)\.ts'/, file);
  }
});

test('no file of the game names a commercial game', () => {
  const spec = path.join(dir, '..', '..', 'e2e', 'charades.spec.ts');
  const files = [...filesIn(dir), ...(fs.existsSync(spec) ? [spec] : [])];
  // Spelled in pieces so this file does not match itself
  const names = new RegExp(`${'pict'}ionary|${'balder'}dash`, 'i');
  for (const file of files) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), names, file);
});
