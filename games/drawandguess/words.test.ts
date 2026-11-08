import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { WORDS } from './words.ts';

test('every word is lowercase letters, single spaces or hyphens', () => {
  for (const word of WORDS) assert.match(word, /^[a-z]+([ -][a-z]+)*$/);
});

test('the list has at least 300 unique words', () => {
  assert.ok(WORDS.length >= 300, `only ${WORDS.length} words`);
  assert.equal(new Set(WORDS).size, WORDS.length);
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
