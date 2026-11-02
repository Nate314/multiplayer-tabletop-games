import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const lastMove: LastMove = { type: 'roll', playerNumber: 2, roll: 2, from: 1, landed: 3, to: 22, via: 'ladder', stayed: false, again: false };

test('describes a roll, and nothing before the first', () => {
  assert.equal(describeMove({ lastMove, playerNames }), 'Bob rolled 2 and climbed a ladder from 3 to 22');
  assert.equal(describeMove({ lastMove: null, playerNames }), '');
});
