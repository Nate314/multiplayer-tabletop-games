import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });

test('describes making trump', () => {
  assert.equal(describe({ type: 'orderUp', playerNumber: 2, suit: 'hearts' }), 'Bob ordered up hearts');
  assert.equal(describe({ type: 'pass', playerNumber: 3, turnedDown: false, redeal: false }), 'Cara passed');
  assert.equal(describe({ type: 'pass', playerNumber: 4, turnedDown: true, redeal: false }), 'Dan passed. The turned card is turned down');
  assert.equal(describe({ type: 'pass', playerNumber: 4, turnedDown: false, redeal: true }),
    'Dan passed. Everyone passed twice, so the cards are dealt again');
  assert.equal(describe({ type: 'nameTrump', playerNumber: 1, suit: 'spades' }), 'Alice named spades trump');
  assert.equal(describe({ type: 'goAlone', playerNumber: 1, alone: true }), 'Alice goes alone');
  assert.equal(describe({ type: 'goAlone', playerNumber: 1, alone: false }), 'Alice plays with their partner');
  assert.equal(describe({ type: 'discard', playerNumber: 4 }), 'Dan discarded a card');
});

test('describes plays and who took the trick', () => {
  assert.equal(describe({ type: 'play', playerNumber: 1, card: { suit: 'clubs', rank: 'A' }, trickWinner: null }), 'Alice played ace of clubs');
  assert.equal(describe({ type: 'play', playerNumber: 4, card: { suit: 'hearts', rank: 'J' }, trickWinner: 4 }), 'Dan played jack of hearts and took the trick');
  assert.equal(describe({ type: 'play', playerNumber: 4, card: { suit: 'spades', rank: '9' }, trickWinner: 2 }),
    'Dan played 9 of spades; Bob took the trick');
});

test('nothing before the first move', () => {
  assert.equal(describe(null), '');
});
