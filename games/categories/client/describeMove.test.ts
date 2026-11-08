import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob', 3: 'Cara' };
const list = ['Fruits', 'Animals'];
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames, list });

test('describes each move', () => {
  assert.equal(describe({ type: 'answers', playerNumber: 1 }), 'Alice started answering');
  assert.equal(describe({ type: 'done', playerNumber: 1 }), 'Alice is done');
  assert.equal(describe({ type: 'closeAnswers', reason: 'allDone' }), 'Everyone is done');
  assert.equal(describe({ type: 'closeAnswers', reason: 'timeUp' }), 'Time is up');
  assert.equal(describe({ type: 'challenge', playerNumber: 2, category: 0, seat: 1 }), "Bob challenged Alice's answer for Fruits");
  assert.equal(describe({ type: 'judge', playerNumber: 3, category: 0, seat: 1 }), "Cara voted on Alice's answer for Fruits");
  assert.equal(describe({ type: 'verdict', category: 0, seat: 1, rejected: true }), "Alice's answer for Fruits was rejected");
  assert.equal(describe({ type: 'verdict', category: 0, seat: 1, rejected: false }), "Alice's answer for Fruits was kept");
  assert.equal(describe({ type: 'continue', playerNumber: 1 }), 'Alice is ready for the next round');
  assert.equal(describe({ type: 'nextRound', round: 2, letter: 'M' }), 'Round 2: the letter is M');
});

test('describes nothing before the first move', () => {
  assert.equal(describe(null), '');
});
