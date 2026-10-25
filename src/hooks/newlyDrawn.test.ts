import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextDrawn } from './newlyDrawn.ts';

const step = (add: number[], clear = false) => () => ({ add, clear });

test('the first state highlights nothing', () => { assert.deepEqual(nextDrawn([], null, 4, step([1])), []); });
test('one more move adds what the step drew', () => { assert.deepEqual(nextDrawn([1], 4, 5, step([2])), [1, 2]); });
test('a clearing step drops the earlier cards first', () => { assert.deepEqual(nextDrawn([1], 4, 5, step([2], true)), [2]); });
test('a vote, an action or a disconnect (same move count) keeps the highlight', () => { assert.deepEqual(nextDrawn([1], 5, 5, step([9])), [1]); });
test('an undo or a jump of several moves clears it', () => {
  assert.deepEqual(nextDrawn([1], 5, 4, step([9])), []);
  assert.deepEqual(nextDrawn([1], 5, 7, step([9])), []);
});
