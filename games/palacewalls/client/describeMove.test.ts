import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes tiles taken from a factory to a pattern line', () => {
  const lastMove: LastMove = { playerNumber: 1, source: { type: 'factory', index: 2 }, color: 'blue', count: 3, line: 2 };
  assert.equal(describeMove({ lastMove, playerNames }), 'Alice took 3 blue from factory 3 to line 3');
});

test('describes tiles taken from the center to the floor', () => {
  const lastMove: LastMove = { playerNumber: 2, source: { type: 'center' }, color: 'red', count: 1, line: 'floor' };
  assert.equal(describeMove({ lastMove, playerNames }), 'Bob took 1 red from the center to the floor');
});
