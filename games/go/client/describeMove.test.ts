import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const size = 9 as const;
const point = { row: 5, col: 3 }; // D4 on a 9x9 board

test('describes a stone placed', () => {
  const lastMove = { type: 'place' as const, playerNumber: 1 as const, point, captured: 0 };
  assert.equal(describeMove({ lastMove, playerNames, size }), 'Alice played D4');
});

test('describes a stone placed with captures', () => {
  const lastMove = { type: 'place' as const, playerNumber: 1 as const, point, captured: 2 };
  assert.equal(describeMove({ lastMove, playerNames, size }), 'Alice played D4 and captured 2');
});

test('describes a pass', () => {
  const lastMove = { type: 'pass' as const, playerNumber: 1 as const };
  assert.equal(describeMove({ lastMove, playerNames, size }), 'Alice passed');
});

test('describes the count', () => {
  const score = { black: { stones: 20, territory: 25, total: 45 }, white: { stones: 18, territory: 18, komi: 7.5, total: 43.5 } };
  const lastMove = { type: 'score' as const, playerNumber: 2 as const, score };
  assert.equal(describeMove({ lastMove, playerNames, size }), 'Counted: Black 45, White 43.5');
});
