import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob', 3: 'Cara' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames, drawer: 1 });

test('describes choosing a word, by hand or by the clock', () => {
  assert.equal(describe({ type: 'choose', playerNumber: 1 }), 'Alice chose a word');
  assert.equal(describe({ type: 'autoChoose', playerNumber: 1 }), 'Alice ran out of time, so a word was picked');
});

test('describes a scoring guess', () => {
  assert.equal(describe({ type: 'guess', playerNumber: 2, points: 85 }), 'Bob guessed the word (+85)');
});

test('describes each kind of reveal', () => {
  assert.equal(describe({ type: 'reveal', word: 'castle', reason: 'allGuessed' }), 'Everyone guessed it: castle');
  assert.equal(describe({ type: 'reveal', word: 'castle', reason: 'timeUp' }), 'Time ran out: the word was castle');
  assert.equal(describe({ type: 'reveal', word: 'castle', reason: 'drawerLeft' }), 'Alice left: the word was castle');
});

test('describes the next turn', () => {
  assert.equal(describe({ type: 'nextTurn', playerNumber: 3 }), 'Cara\'s turn to draw');
});

test('describes nothing before the first move', () => {
  assert.equal(describe(null), '');
});
