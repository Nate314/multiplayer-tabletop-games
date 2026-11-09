import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { standardOf } from '../../shared/houseRules.ts';
import { WORD_COUNT, WRITING_SECONDS } from './options.ts';

const dir = import.meta.dirname;
const filesIn = (root: string) => fs.readdirSync(root, { recursive: true, encoding: 'utf8' })
  .map(file => path.join(root, file)).filter(full => fs.statSync(full).isFile());

test('house rules default to 8 words and 2 minutes', () => {
  assert.equal(standardOf(WORD_COUNT, 4), 8);
  assert.equal(standardOf(WRITING_SECONDS, 4), 120);
});

test('no file of the game names a commercial game', () => {
  const spec = path.join(dir, '..', '..', 'e2e', 'fictionary.spec.ts');
  const files = [...filesIn(dir), ...(fs.existsSync(spec) ? [spec] : [])];
  // Spelled in pieces so this file does not match itself
  const names = new RegExp(`${'balder'}dash|${'pict'}ionary`, 'i');
  for (const file of files) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), names, file);
});
