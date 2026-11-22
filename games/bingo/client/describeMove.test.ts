import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });

test('describes a call by its letter and number', () => {
  assert.equal(describe({ type: 'call', seat: 1, number: 42 }), 'Alice called N 42');
});

test('describes a claim with the place it won', () => {
  assert.equal(describe({ type: 'bingo', seat: 2, place: 1 }), 'Bob shouted Bingo (1st place)');
});

test('describes nothing before the first call', () => {
  assert.equal(describe(null), '');
});
