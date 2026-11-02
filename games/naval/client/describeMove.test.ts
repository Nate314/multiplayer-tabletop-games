import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes a single shot and a salvo', () => {
  const single: LastMove = { type: 'fire', playerNumber: 1, shots: [{ row: 1, col: 6, result: 'miss' }] };
  assert.equal(describeMove({ lastMove: single, playerNames }), 'Alice fired at B7: miss');
  const salvo: LastMove = {
    type: 'fire', playerNumber: 2, shots: [
      { row: 1, col: 6, result: 'hit' }, { row: 2, col: 6, result: 'miss' }, { row: 3, col: 6, result: 'sunk', sunkLength: 3 }
    ]
  };
  assert.equal(describeMove({ lastMove: salvo, playerNames }), 'Bob fired at B7, C7 and D7: hit, miss, sank a ship of length 3');
});

test('describes nothing without a last move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames }), '');
});
