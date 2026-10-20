import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });

test('describes bids, nil included', () => {
  assert.equal(describe({ type: 'bid', playerNumber: 1, tricks: 4 }), 'Alice bid 4');
  assert.equal(describe({ type: 'bid', playerNumber: 2, tricks: 0 }), 'Bob bid nil');
});

test('describes plays and who took the trick', () => {
  assert.equal(describe({ type: 'play', playerNumber: 1, card: { suit: 'hearts', rank: '10' }, trickWinner: null }), 'Alice played the 10 of hearts');
  assert.equal(describe({ type: 'play', playerNumber: 4, card: { suit: 'spades', rank: 'A' }, trickWinner: 4 }), 'Dan played the ace of spades and took the trick');
  assert.equal(describe({ type: 'play', playerNumber: 4, card: { suit: 'clubs', rank: '2' }, trickWinner: 2 }),
    'Dan played the 2 of clubs; Bob took the trick');
});

test('nothing before the first move', () => {
  assert.equal(describe(null), '');
});
