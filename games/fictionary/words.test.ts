import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sameText } from './matching.ts';
import { WORDS } from './words.ts';

test('the list has at least 200 entries with no repeated word or definition', () => {
  assert.ok(WORDS.length >= 200, `only ${WORDS.length} entries`);
  assert.equal(new Set(WORDS.map(entry => entry.word)).size, WORDS.length);
  WORDS.forEach((a, i) => {
    for (const b of WORDS.slice(i + 1)) assert.ok(!sameText(a.definition, b.definition), `${a.word} and ${b.word}`);
  });
});

test('every word is one lowercase word', () => {
  for (const { word } of WORDS) assert.match(word, /^[a-z]+(-[a-z]+)?$/);
});

test('every definition is short and plain', () => {
  for (const { word, definition } of WORDS) {
    assert.ok(definition.length >= 10 && definition.length <= 100, word);
    assert.match(definition, /^[a-z]/, word);
    assert.ok(!definition.endsWith('.'), word);
    assert.match(definition, /^[a-z0-9 ,;'()-]+$/, word);
  }
});

test('no definition contains its own word', () => {
  for (const { word, definition } of WORDS) assert.doesNotMatch(definition, new RegExp(`\\b${word}`), word);
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
