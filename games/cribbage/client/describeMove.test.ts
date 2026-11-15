import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { Card, LastMove, ScoreItem } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames, dealer: 1 });
const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });
const item = (kind: ScoreItem['kind'], points: number, cards: Card[] = []): ScoreItem => ({ kind, cards, points });

test('describes the deal, the cut and pegging', () => {
  assert.equal(describe({ type: 'discard', playerNumber: 2 }), 'Bob laid cards in the crib');
  assert.equal(describe({ type: 'cut', playerNumber: 2, starter: card('5', 'spades'), heels: false }), 'Bob cut the 5 of spades');
  assert.equal(describe({ type: 'cut', playerNumber: 2, starter: card('J', 'spades'), heels: true }),
    'Bob cut the jack of spades. His heels: Alice scores 2');
  assert.equal(describe({ type: 'play', playerNumber: 1, card: card('5', 'hearts'), items: [item('fifteen', 2)] }),
    'Alice played the 5 of hearts for fifteen two');
  assert.equal(describe({ type: 'play', playerNumber: 1, card: card('5', 'hearts'), items: [item('fifteen', 2), item('pair', 2, [card('5', 'clubs'), card('5', 'hearts')])] }),
    'Alice played the 5 of hearts for fifteen two and a pair');
  assert.equal(describe({ type: 'play', playerNumber: 3, card: card('K', 'clubs'), items: [] }), 'Cara played the king of clubs');
  assert.equal(describe({ type: 'go', playerNumber: 2, lastCard: false }), 'Bob said Go');
  assert.equal(describe({ type: 'go', playerNumber: 2, lastCard: true }), 'Bob said Go, and the last to play scored 1');
});

test('describes counts, claims and Muggins', () => {
  const pairCards = [card('7', 'hearts'), card('7', 'clubs')];
  const six = [item('fifteen', 2), item('fifteen', 2), item('pair', 2, pairCards)];
  assert.equal(describe({ type: 'count', playerNumber: 3, crib: false, points: 6, items: six }),
    'Cara counted 6: Fifteen two, fifteen four, and a pair is six');
  assert.equal(describe({ type: 'count', playerNumber: 1, crib: true, points: 6, items: six }),
    'Alice counted 6 in the crib: Fifteen two, fifteen four, and a pair is six');
  assert.equal(describe({ type: 'count', playerNumber: 3, crib: false, points: 4, items: six }),
    'Cara scored the 4 claimed: Fifteen two, fifteen four, and a pair is six');
  assert.equal(describe({ type: 'claim', playerNumber: 3, crib: false, points: 4 }), 'Cara claimed 4 for their hand');
  assert.equal(describe({ type: 'claim', playerNumber: 1, crib: true, points: 0 }), 'Alice claimed 0 for the crib');
  assert.equal(describe({ type: 'muggins', playerNumber: 4, points: 2 }), 'Dan called Muggins and took 2');
  assert.equal(describe({ type: 'muggins', playerNumber: 4, points: -2 }), 'Dan called Muggins, but nothing was missed: it cost 2');
  assert.equal(describe({ type: 'noMuggins', playerNumber: 2 }), 'Bob said No Muggins');
});

test('nothing before the first move', () => {
  assert.equal(describe(null), '');
});
