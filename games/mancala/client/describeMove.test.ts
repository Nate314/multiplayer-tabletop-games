import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes a plain move with the pit numbered from the mover\'s left', () => {
  const lastMove = { playerNumber: 2, pit: 9, end: 13, pickedUp: 4, captured: 0, extraTurn: false };
  assert.equal(describeMove({ lastMove, playerNames }), 'Bob picked up 4 stones from pit 3');
});

test('describes an extra turn', () => {
  const lastMove = { playerNumber: 1, pit: 2, end: 6, pickedUp: 4, captured: 0, extraTurn: true };
  assert.equal(describeMove({ lastMove, playerNames }), 'Alice picked up 4 stones from pit 3 for an extra turn');
});

test('describes a capture', () => {
  const lastMove = { playerNumber: 1, pit: 0, end: 1, pickedUp: 1, captured: 8, extraTurn: false };
  assert.equal(describeMove({ lastMove, playerNames }), 'Alice picked up 1 stone from pit 1 and captured 8');
});

test('describes nothing before the first move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames }), '');
});
