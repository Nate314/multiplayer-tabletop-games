import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });
const move = (fields: Partial<LastMove>): LastMove =>
  ({ type: 'check', playerNumber: 1, to: 0, paid: 0, allIn: false, bet: false, ...fields });

test('describes folds and checks', () => {
  assert.equal(describe(move({ type: 'fold' })), 'Alice folded');
  assert.equal(describe(move({ type: 'check', playerNumber: 2 })), 'Bob checked');
});

test('describes calls with what they cost, and all-ins', () => {
  assert.equal(describe(move({ type: 'call', to: 60, paid: 40 })), 'Alice called 40');
  assert.equal(describe(move({ type: 'call', to: 1000, paid: 980, allIn: true })), 'Alice called 980 (all in)');
});

test('describes a first bet and a raise by the total', () => {
  assert.equal(describe(move({ type: 'raise', to: 20, paid: 20, bet: true })), 'Alice bet 20');
  assert.equal(describe(move({ type: 'raise', to: 1500, paid: 1480 })), 'Alice raised to 1,500');
  assert.equal(describe(move({ type: 'raise', to: 50, paid: 40, allIn: true })), 'Alice raised to 50 (all in)');
});

test('describes nothing before the first move', () => {
  assert.equal(describe(null), '');
});
