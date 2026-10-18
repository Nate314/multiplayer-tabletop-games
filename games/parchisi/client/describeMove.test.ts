import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import { HOME, NEST } from '../rules.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const move = { playerNumber: 2, pawn: 0, from: 10, to: 14, steps: 4, captured: null };

test('describes entering, moving and reaching home', () => {
  assert.equal(describeMove({ lastMove: { ...move, from: NEST, to: 0, steps: 5 }, playerNames }), 'Bob entered a pawn');
  assert.equal(describeMove({ lastMove: move, playerNames }), 'Bob moved a pawn 4 squares');
  assert.equal(describeMove({ lastMove: { ...move, to: 11, steps: 1 }, playerNames }), 'Bob moved a pawn 1 square');
  assert.equal(describeMove({ lastMove: { ...move, from: 68, to: HOME, steps: 3 }, playerNames }), 'Bob moved a pawn home (+10)');
});

test('describes a capture', () => {
  const lastMove = { ...move, captured: { seat: 1, pawn: 2 } };
  assert.equal(describeMove({ lastMove, playerNames }), "Bob moved a pawn 4 squares and captured Alice's pawn (+20)");
});

test('a state without a move has no description', () => {
  assert.equal(describeMove({ lastMove: null, playerNames }), '');
});
