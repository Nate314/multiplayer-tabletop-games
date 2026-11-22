import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dealCard, hasPattern, letterOf } from './cards.ts';
import type { Card } from './types.ts';

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

test('a dealt card follows the column ranges', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const card = dealCard(seeded(seed));
    assert.equal(card[12], 0);
    for (let col = 0; col < 5; col++) {
      const column = [0, 1, 2, 3, 4].map(row => card[row * 5 + col]).filter((_, row) => row * 5 + col !== 12);
      assert.equal(new Set(column).size, col === 2 ? 4 : 5);
      for (const n of column) assert.ok(n >= 15 * col + 1 && n <= 15 * col + 15);
    }
  }
});

const card: Card = dealCard(seeded(7));

test('hasPattern finds every line and nothing less', () => {
  const lines = [
    ...[0, 1, 2, 3, 4].map(row => [0, 1, 2, 3, 4].map(col => row * 5 + col)),
    ...[0, 1, 2, 3, 4].map(col => [0, 1, 2, 3, 4].map(row => row * 5 + col)),
    [0, 6, 12, 18, 24], [4, 8, 12, 16, 20]
  ];
  for (const line of lines) {
    const marked = line.filter(i => i !== 12);
    assert.ok(hasPattern(card, marked, 'line'), line.join());
    assert.ok(!hasPattern(card, marked.slice(1), 'line'), `${line.join()} short`);
  }
  assert.ok(!hasPattern(card, [0, 1, 2, 3], 'line'));
});

test('four corners and blackout', () => {
  assert.ok(hasPattern(card, [0, 4, 20, 24], 'corners'));
  assert.ok(!hasPattern(card, [0, 4, 20, 24], 'blackout'));
  const all = Array.from({ length: 25 }, (_, i) => i).filter(i => i !== 12);
  assert.ok(hasPattern(card, all, 'blackout'));
  assert.ok(!hasPattern(card, all.slice(1), 'blackout'));
});

test('letterOf', () => {
  assert.equal(letterOf(1), 'B');
  assert.equal(letterOf(15), 'B');
  assert.equal(letterOf(16), 'I');
  assert.equal(letterOf(75), 'O');
});
