import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { Ask } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const describe = (lastMove: Ask | null) => describeMove({ lastMove, playerNames });
const asked = (overrides: Partial<Ask>): Ask =>
  ({ asker: 1, target: 2, rank: 'K', given: 0, fished: 'other', books: [], goesAgain: false, ...overrides });

test('describes a hit, with the books it made', () => {
  assert.equal(describe(asked({ given: 3, fished: 'none', goesAgain: true })), 'Alice asked Bob for kings and got 3. Alice goes again.');
  assert.equal(describe(asked({ rank: 'A', given: 1, fished: 'none', books: ['A'], goesAgain: true })),
    'Alice asked Bob for aces and got 1. Alice laid down the aces. Alice goes again.');
});

test('describes going fish', () => {
  assert.equal(describe(asked({})), 'Alice asked Bob for kings: go fish! Alice drew a card.');
  assert.equal(describe(asked({ rank: '8', fished: 'asked', goesAgain: true })),
    'Alice asked Bob for 8s: go fish! Alice drew an 8. Alice goes again.');
  assert.equal(describe(asked({ rank: '3', fished: 'empty' })), 'Alice asked Bob for 3s: go fish! The stock is empty.');
});

test('describes nothing before the first ask', () => {
  assert.equal(describe(null), '');
});
