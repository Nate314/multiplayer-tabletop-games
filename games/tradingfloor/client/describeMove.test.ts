import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const state = (lastMove: unknown) => ({ playerNames: { 1: 'Alice', 2: 'Bob' }, lastMove }) as never;

test('a swap', () => {
  assert.equal(describeMove(state({ type: 'swap', seats: [1, 2], count: 3 })), 'Alice and Bob swapped 3 cards');
});
test('a corner', () => {
  assert.equal(describeMove(state({ type: 'corner', playerNumber: 1, commodity: 'saffron', points: 100, double: false })),
    'Alice cornered Saffron for 100 points');
});
test('a corner doubled by the Bull', () => {
  assert.equal(describeMove(state({ type: 'corner', playerNumber: 1, commodity: 'saffron', points: 200, double: true })),
    'Alice cornered Saffron with the Bull for 200 points');
});
test('no move', () => {
  assert.equal(describeMove(state(null)), '');
});
