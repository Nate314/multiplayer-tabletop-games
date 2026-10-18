import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes a play with every word it formed', () => {
  const lastMove: LastMove = {
    type: 'play', playerNumber: 1, tiles: [], bingo: false, points: 10,
    words: [{ word: 'AT', points: 3 }, { word: 'CA', points: 5 }, { word: 'AT', points: 2 }]
  };
  assert.equal(describeMove({ lastMove, playerNames }), 'Alice played AT, CA and AT for 10 points');
});

test('describes a bingo', () => {
  const lastMove: LastMove = { type: 'play', playerNumber: 2, tiles: [], bingo: true, points: 66, words: [{ word: 'RETAINS', points: 16 }] };
  assert.equal(describeMove({ lastMove, playerNames }), 'Bob played RETAINS for 66 points (bingo!)');
});

test('describes an exchange and a pass', () => {
  assert.equal(describeMove({ lastMove: { type: 'exchange', playerNumber: 1, count: 1 }, playerNames }), 'Alice exchanged 1 tile');
  assert.equal(describeMove({ lastMove: { type: 'exchange', playerNumber: 2, count: 4 }, playerNames }), 'Bob exchanged 4 tiles');
  assert.equal(describeMove({ lastMove: { type: 'pass', playerNumber: 2 }, playerNames }), 'Bob passed');
});

test('describes nothing before the first move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames }), '');
});
