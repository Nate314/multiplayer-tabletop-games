import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });

test('describes draws without naming a card from the pile', () => {
  assert.equal(describe({ playerNumber: 1, type: 'draw', source: 'pile' }), 'Alice drew from the pile');
  assert.equal(
    describe({ playerNumber: 2, type: 'draw', source: 'discard', card: { id: 3, kind: 'number', value: 4, color: 'blue' } }),
    'Bob took the blue 4 from the discard pile'
  );
});

test('describes laying down and hitting', () => {
  assert.equal(describe({ playerNumber: 1, type: 'layDown', phase: 3 }), 'Alice laid down phase 3');
  assert.equal(describe({ playerNumber: 1, type: 'hit', group: 0, owner: 2, kind: 'run', count: 2 }), 'Alice hit 2 cards on Bob\'s run');
  assert.equal(describe({ playerNumber: 2, type: 'hit', group: 1, owner: 2, kind: 'color', count: 1 }), 'Bob hit 1 card on their own color group');
});

test('describes discards, with whom a Skip skipped', () => {
  assert.equal(describe({ playerNumber: 1, type: 'discard', card: { id: 9, kind: 'wild' }, skipped: null }), 'Alice discarded a Wild');
  assert.equal(describe({ playerNumber: 1, type: 'discard', card: { id: 100, kind: 'skip' }, skipped: 2 }), 'Alice discarded a Skip on Bob');
  assert.equal(describe(null), '');
});
