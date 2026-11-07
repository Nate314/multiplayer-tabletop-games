import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CAREERS, HOUSES } from './content.ts';

test('careers and houses have unique ids and sane numbers', () => {
  for (const list of [CAREERS, HOUSES]) {
    assert.equal(new Set(list.map(x => x.id)).size, list.length);
    for (const x of list) assert.match(x.id, /^[a-z]+$/);
  }
  const degree = CAREERS.filter(c => c.degree);
  const plain = CAREERS.filter(c => !c.degree);
  assert.ok(degree.length >= 8 && plain.length >= 8 && HOUSES.length >= 8);
  const topPlain = Math.max(...plain.map(c => c.salary));
  for (const c of degree) assert.ok(c.salary > topPlain, c.id);
  for (const h of HOUSES) assert.ok(h.saleValue > 0 && h.price > 0, h.id);
});

// Built in two parts so this file does not match itself
const COMMERCIAL_NAME = 'Game of ' + 'Life';
const COMMERCIAL = new RegExp(COMMERCIAL_NAME, 'i');

function files(path: string): string[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap(name => files(join(path, name)));
}

test('no file of the game names the commercial game', () => {
  const root = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const all = [...files(join(root, 'games/roadtoretirement')), ...files(join(root, 'e2e/roadtoretirement.spec.ts'))];
  for (const file of all) {
    const readme = file.endsWith('README.md');
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (!COMMERCIAL.test(line)) return;
      const allowed = readme && (line.includes('wikipedia.org') || line.includes('The Checkered ' + COMMERCIAL_NAME) || /^An? .*(career|race|game)/i.test(line));
      assert.ok(allowed, `${file}:${i + 1}: ${line}`);
    });
  }
});
