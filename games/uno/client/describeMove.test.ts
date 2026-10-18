import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });

test('describes a plain play and a Wild with its color', () => {
  assert.equal(describe({ type: 'play', playerNumber: 1, card: { color: 'red', value: '7' }, color: 'red', target: null, drew: 0 }),
    'Alice played red 7');
  assert.equal(describe({ type: 'play', playerNumber: 2, card: { color: 'wild', value: 'wild' }, color: 'green', target: null, drew: 0 }),
    'Bob played Wild (green)');
});

test('describes who a card skipped and what they drew', () => {
  assert.equal(describe({ type: 'play', playerNumber: 1, card: { color: 'blue', value: 'skip' }, color: 'blue', target: 2, drew: 0 }),
    'Alice played blue Skip; Bob is skipped');
  assert.equal(describe({ type: 'play', playerNumber: 1, card: { color: 'wild', value: 'wildDrawFour' }, color: 'red', target: 2, drew: 4 }),
    'Alice played Wild Draw Four (red); Bob draws 4 and is skipped');
});

test('describes draws and passes', () => {
  assert.equal(describe({ type: 'draw', playerNumber: 2, passed: false }), 'Bob drew a card');
  assert.equal(describe({ type: 'draw', playerNumber: 2, passed: true }), 'Bob drew a card and could not play it');
  assert.equal(describe({ type: 'pass', playerNumber: 1 }), 'Alice passed');
  assert.equal(describe(null), '');
});
