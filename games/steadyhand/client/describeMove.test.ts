import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('bringing a part out names it and its points', () => {
  assert.equal(describeMove({ playerNames, lastMove: { type: 'out', playerNumber: 1, part: 1, value: 15 } }), 'Alice brought out the Gear for 15 points');
});

test('a buzz names the part', () => {
  assert.equal(describeMove({ playerNames, lastMove: { type: 'buzz', playerNumber: 1, part: 4, at: [900, 270] } }), 'Alice buzzed on the Coil');
});

test('the start has no move', () => {
  assert.equal(describeMove({ playerNames, lastMove: null }), '');
});
