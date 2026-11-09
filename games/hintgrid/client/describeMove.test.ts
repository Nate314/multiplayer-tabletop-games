import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const words = Array.from({ length: 25 }, (_, i) => `w${i}`);
words[3] = 'whale';
words[4] = 'anchor';
words[5] = 'ocean';
words[6] = 'bomb';
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames, words });
const guess = (index: number, kind: 'red' | 'blue' | 'bystander' | 'trap'): LastMove => ({ type: 'guess', playerNumber: 2, index, kind });

test('describes a clue', () => {
  assert.equal(describe({ type: 'clue', playerNumber: 1, clue: { team: 'red', word: 'sea', count: 2 } }), 'Alice gave the clue sea 2');
});

test('describes each kind of card turned over', () => {
  assert.equal(describe(guess(3, 'red')), 'Bob turned over whale: Red');
  assert.equal(describe(guess(4, 'bystander')), 'Bob turned over anchor: a bystander');
  assert.equal(describe(guess(5, 'blue')), 'Bob turned over ocean: Blue');
  assert.equal(describe(guess(6, 'trap')), 'Bob turned over bomb: the trap');
});

test('describes ending guessing and no move', () => {
  assert.equal(describe({ type: 'endGuessing', playerNumber: 2 }), 'Bob ended guessing');
  assert.equal(describe(null), '');
});
