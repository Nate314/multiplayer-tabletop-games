import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import { withRules } from '../../../server/testing.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob', 3: 'Cara' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames, houseRules: withRules({}) });

test('describes writing and the end of writing', () => {
  assert.equal(describe({ type: 'write', playerNumber: 1 }), 'Alice wrote a definition');
  assert.equal(describe({ type: 'closeWriting', reason: 'allWritten' }), 'Everyone has written');
  assert.equal(describe({ type: 'closeWriting', reason: 'timeUp' }), 'Writing time is up');
});

test('describes a vote without saying for which choice', () => {
  assert.equal(describe({ type: 'vote', playerNumber: 2 }), 'Bob voted');
});

test('describes the reveal', () => {
  assert.equal(
    describe({ type: 'reveal', word: 'quillon', definition: 'either arm of the cross guard of a sword' }),
    'The real definition of quillon: either arm of the cross guard of a sword'
  );
});

test('describes the next word out of the number of words', () => {
  assert.equal(describe({ type: 'nextWord', round: 2 }), 'Word 2 of 8');
  assert.equal(describeMove({ lastMove: { type: 'nextWord', round: 3 }, playerNames, houseRules: withRules({ wordCount: 5 }) }), 'Word 3 of 5');
});

test('describes nothing before the first move', () => {
  assert.equal(describe(null), '');
});
