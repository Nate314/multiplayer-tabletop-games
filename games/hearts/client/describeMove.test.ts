import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });

test('describes plays and who took the trick', () => {
  assert.equal(describe({ type: 'play', playerNumber: 1, card: { suit: 'clubs', rank: '2' }, trickWinner: null }), 'Alice played 2 of clubs');
  assert.equal(describe({ type: 'play', playerNumber: 4, card: { suit: 'hearts', rank: 'A' }, trickWinner: 4 }), 'Dan played ace of hearts and took the trick');
  assert.equal(describe({ type: 'play', playerNumber: 4, card: { suit: 'spades', rank: 'Q' }, trickWinner: 2 }),
    'Dan played queen of spades; Bob took the trick');
});

test('nothing before the first move', () => {
  assert.equal(describe(null), '');
});
