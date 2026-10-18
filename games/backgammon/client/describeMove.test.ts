import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes a move with points numbered from the mover\'s side', () => {
  assert.equal(describeMove({ lastMove: { playerNumber: 1, from: 12, to: 6, hit: false }, playerNames }), 'Alice moved 13 to 7');
  assert.equal(describeMove({ lastMove: { playerNumber: 2, from: 11, to: 17, hit: false }, playerNames }), 'Bob moved 13 to 7');
});

test('describes entering, hitting and bearing off', () => {
  assert.equal(describeMove({ lastMove: { playerNumber: 2, from: 'bar', to: 2, hit: true }, playerNames }), 'Bob entered on 22 and hit');
  assert.equal(describeMove({ lastMove: { playerNumber: 1, from: 2, to: 'off', hit: false }, playerNames }), 'Alice bore off from 3');
});

test('describes nothing before the first move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames }), '');
});
