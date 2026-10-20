import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });
const roll = (rest: Partial<Extract<LastMove, { type: 'roll' }>>): LastMove =>
  ({ type: 'roll', playerNumber: 1, kept: [], points: 0, dice: [1, 2, 3], hot: false, farkle: false, lost: 0, ...rest });

test('describes a first roll and a roll after setting dice aside', () => {
  assert.equal(describe(roll({ dice: [1, 2, 3, 4, 5, 6] })), 'Alice rolled 1, 2, 3, 4, 5, 6');
  assert.equal(describe(roll({ kept: [1, 5], points: 150 })), 'Alice set aside 1, 5 for 150 points and rolled 1, 2, 3');
});

test('describes hot dice, a farkle and a bank', () => {
  assert.equal(describe(roll({ kept: [1, 1, 1, 5, 5, 5], points: 1500, hot: true })),
    'Alice set aside 1, 1, 1, 5, 5, 5 for 1500 points and has hot dice and rolled 1, 2, 3');
  assert.equal(describe(roll({ farkle: true, lost: 1 })), 'Alice rolled 1, 2, 3: Farkle! Alice loses 1 point');
  assert.equal(describe({ type: 'bank', playerNumber: 2, kept: [1], points: 100, total: 350 }), 'Bob banked 350 points');
});

test('describes nothing before the first move', () => {
  assert.equal(describe(null), '');
});
