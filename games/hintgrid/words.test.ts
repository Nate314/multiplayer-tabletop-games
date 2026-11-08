import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { WORDS } from './words.ts';

test('the list has at least 400 words, none repeated', () => {
  assert.ok(WORDS.length >= 400, `only ${WORDS.length} words`);
  assert.equal(new Set(WORDS).size, WORDS.length);
  for (const word of ['ocean', 'whale', 'anchor']) assert.ok(WORDS.includes(word), word);
});

test('every word is one lowercase word', () => {
  for (const word of WORDS) assert.match(word, /^[a-z]+$/);
});

test('no client file imports rules.ts or words.ts', () => {
  const dir = path.join(import.meta.dirname, 'client');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true, encoding: 'utf8' }) : [];
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) continue;
    assert.doesNotMatch(fs.readFileSync(full, 'utf8'), /from '\.\.\/(rules|words)\.ts'/, file);
  }
});

test('no file of the game names the commercial game outside its README', () => {
  // built from fragments so this file does not hold the words itself
  const forbidden = new RegExp([['code', 'names'], ['spy', 'master'], ['assas', 'sin']].map((p) => p.join('')).join('|'), 'i');
  const dir = import.meta.dirname;
  const files = fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f !== 'README.md')
    .map((f) => path.join(dir, f));
  const spec = path.join(dir, '..', '..', 'e2e', 'hintgrid.spec.ts');
  if (fs.existsSync(spec)) files.push(spec);
  for (const file of files) {
    if (fs.statSync(file).isDirectory()) continue;
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), forbidden, file);
  }
});
