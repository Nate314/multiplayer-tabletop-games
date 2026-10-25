import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });

test('describes bids and passes', () => {
  assert.equal(describe({ type: 'bid', playerNumber: 1, amount: 85, won: false }), 'Alice bid 85');
  assert.equal(describe({ type: 'bid', playerNumber: 2, amount: 120, won: true }), 'Bob bid 120, the most there is, and takes the nest');
  assert.equal(describe({ type: 'pass', playerNumber: 3, won: null, redeal: false }), 'Cara passed');
  assert.equal(describe({ type: 'pass', playerNumber: 3, won: { seat: 1, amount: 90 }, redeal: false }),
    'Cara passed. Alice won the bidding at 90 and takes the nest');
  assert.equal(describe({ type: 'pass', playerNumber: 4, won: null, redeal: true }),
    'Dan passed. Everyone passed, so the cards are dealt again');
});

test('describes the nest and trump', () => {
  assert.equal(describe({ type: 'discard', playerNumber: 1 }), 'Alice laid aside 5 cards');
  assert.equal(describe({ type: 'nameTrump', playerNumber: 1, color: 'green' }), 'Alice named green trump');
});

test('describes plays and who took the trick', () => {
  assert.equal(describe({ type: 'play', playerNumber: 1, card: { color: 'red', number: 14 }, trickWinner: null }), 'Alice played red 14');
  assert.equal(describe({ type: 'play', playerNumber: 4, card: { color: 'rook' }, trickWinner: 4 }), 'Dan played the Rook and took the trick');
  assert.equal(describe({ type: 'play', playerNumber: 4, card: { color: 'black', number: 5 }, trickWinner: 2 }),
    'Dan played black 5; Bob took the trick');
});

test('describes calling partners and a partner revealed', () => {
  assert.equal(describe({ type: 'callPartner', playerNumber: 1, cards: [{ color: 'red', number: 14 }] }), 'Alice called red 14 for a partner');
  assert.equal(describe({ type: 'callPartner', playerNumber: 1, cards: [{ color: 'rook' }, { color: 'green', number: 5 }] }),
    'Alice called the Rook and green 5 for partners');
  assert.equal(describe({ type: 'play', playerNumber: 3, card: { color: 'red', number: 14 }, trickWinner: 3, partnerOf: 1 }),
    'Cara played red 14 and took the trick. Cara is Alice\'s partner');
});

test('nothing before the first move', () => {
  assert.equal(describe(null), '');
});
