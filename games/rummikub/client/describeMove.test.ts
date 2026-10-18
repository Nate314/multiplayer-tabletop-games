import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes a first meld and a later play', () => {
  const meld = { type: 'play', playerNumber: 1, added: [1, 2, 3], meld: 33, wentOut: false } as const;
  assert.equal(describeMove({ lastMove: meld, playerNames }), 'Alice made their first meld of 33 points with 3 tiles');
  const later = { type: 'play', playerNumber: 2, added: [7], meld: null, wentOut: false } as const;
  assert.equal(describeMove({ lastMove: later, playerNames }), 'Bob played 1 tile');
});

test('describes going out', () => {
  const out = { type: 'play', playerNumber: 2, added: [7, 8], meld: null, wentOut: true } as const;
  assert.equal(describeMove({ lastMove: out, playerNames }), 'Bob played 2 tiles and went out');
});

test('describes a draw and a pass', () => {
  assert.equal(describeMove({ lastMove: { type: 'draw', playerNumber: 1, drew: true }, playerNames }), 'Alice drew a tile');
  assert.equal(describeMove({ lastMove: { type: 'draw', playerNumber: 2, drew: false }, playerNames }), 'Bob passed (the pool is empty)');
});

test('describes nothing before the first move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames }), '');
});
