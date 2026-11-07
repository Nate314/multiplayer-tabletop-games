import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CARDS, OBJECTS, ROOMS, SUSPECTS, kindOf, nameOf } from './content.ts';

test('six suspects, six objects and nine rooms with unique ids', () => {
  assert.equal(SUSPECTS.length, 6);
  assert.equal(OBJECTS.length, 6);
  assert.equal(ROOMS.length, 9);
  assert.equal(CARDS.length, 21);
  assert.equal(new Set(CARDS).size, 21);
  for (const s of SUSPECTS) assert.equal(kindOf(s.id), 'suspect');
  for (const o of OBJECTS) assert.equal(kindOf(o.id), 'object');
  for (const r of ROOMS) assert.equal(kindOf(r.id), 'room');
  for (const s of SUSPECTS) assert.match(s.color, /^--wd-suspect-\d$/);
});

const BANNED = ['Scarlet', 'Mustard', 'White', 'Green', 'Peacock', 'Plum', 'Candlestick', 'Dagger', 'Knife', 'Lead Pipe', 'Revolver', 'Rope', 'Wrench', 'Spanner', 'Kitchen', 'Ballroom', 'Conservatory', 'Dining Room', 'Billiard Room', 'Library', 'Lounge', 'Hall', 'Study'];

test('no card uses a name from the commercial game', () => {
  for (const card of CARDS) {
    for (const word of BANNED) assert.doesNotMatch(nameOf(card), new RegExp(`\b${word}\b`, 'i'), `${nameOf(card)} / ${word}`);
  }
});

function files(path: string): string[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap(f => files(join(path, f)));
}

test('no file of the game names the commercial game', () => {
  const bad = [new RegExp(['clu', 'edo'].join(''), 'i'), new RegExp('\b' + ['clu', 'e'].join('') + '\b', 'i')];
  for (const file of [...files('games/whodunit'), ...files('e2e/whodunit.spec.ts')]) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (line.includes('en.wikipedia.org/wiki/')) continue;
      for (const re of bad) assert.doesNotMatch(line, re, file);
    }
  }
});
