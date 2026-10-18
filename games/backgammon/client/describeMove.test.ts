import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes a move with points numbered from the mover\'s side', () => {
  assert.equal(describeMove({ lastMove: { type: 'move', playerNumber: 1, from: 12, to: 6, hit: false }, playerNames }), 'Alice moved 13 to 7');
  assert.equal(describeMove({ lastMove: { type: 'move', playerNumber: 2, from: 11, to: 17, hit: false }, playerNames }), 'Bob moved 13 to 7');
});

test('describes entering, hitting and bearing off', () => {
  assert.equal(describeMove({ lastMove: { type: 'move', playerNumber: 2, from: 'bar', to: 2, hit: true }, playerNames }), 'Bob entered on 22 and hit');
  assert.equal(describeMove({ lastMove: { type: 'move', playerNumber: 1, from: 2, to: 'off', hit: false }, playerNames }), 'Alice bore off from 3');
});

test('describes rolls and the doubling cube', () => {
  assert.equal(describeMove({ lastMove: { type: 'roll', playerNumber: 1, dice: [6, 5], blocked: false }, playerNames }), 'Alice rolled 6 and 5');
  assert.equal(describeMove({ lastMove: { type: 'roll', playerNumber: 2, dice: [4, 3], blocked: true }, playerNames }), 'Bob rolled 4 and 3 and could not move');
  assert.equal(describeMove({ lastMove: { type: 'double', playerNumber: 1, cube: 2 }, playerNames }), 'Alice offered to double to 2');
  assert.equal(describeMove({ lastMove: { type: 'take', playerNumber: 2, cube: 2 }, playerNames }), 'Bob took the double. The cube is at 2');
  assert.equal(describeMove({ lastMove: { type: 'drop', playerNumber: 2, cube: 1 }, playerNames }), 'Bob dropped the double');
});

test('describes nothing before the first move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames }), '');
});
