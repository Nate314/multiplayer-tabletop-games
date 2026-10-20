import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canFollow, trickWinner } from './tricks.ts';
import type { Play } from './tricks.ts';

type Card = { suit: string; n: number };
const h5 = { suit: 'h', n: 5 };
const h9 = { suit: 'h', n: 9 };
const h13 = { suit: 'h', n: 13 };
const s2 = { suit: 's', n: 2 };
const s7 = { suit: 's', n: 7 };
const s13 = { suit: 's', n: 13 };
const c3 = { suit: 'c', n: 3 };
const suitOf = (card: Card) => card.suit;
const rank = (card: Card) => card.n;
const trickOf = (...cards: Card[]): Play<Card>[] => cards.map((card, index) => ({ seat: index + 1, card }));

test('canFollow allows any card on an empty trick', () => {
  assert.equal(canFollow([h5, s2], s2, [], suitOf), true);
});

test('canFollow requires the led suit when held', () => {
  assert.equal(canFollow([h5, s2], s2, trickOf(h9), suitOf), false);
  assert.equal(canFollow([h5, s2], h5, trickOf(h9), suitOf), true);
});

test('canFollow allows any card when void', () => {
  assert.equal(canFollow([s2, c3], s2, trickOf(h9), suitOf), true);
  assert.equal(canFollow([s2, c3], c3, trickOf(h9), suitOf), true);
});

test('trickWinner takes the highest of the led suit when no trump', () => {
  assert.equal(trickWinner(trickOf(h5, h9, s13), suitOf, rank, null), 2);
});

test('trickWinner takes the highest trump', () => {
  assert.equal(trickWinner(trickOf(h13, s2, s7), suitOf, rank, 's'), 3);
});

test('trickWinner uses suitOf so a card can change suit', () => {
  const asTrump = (card: Card) => (card === h5 ? 's' : card.suit);
  assert.equal(trickWinner(trickOf(h9, h13, h5), asTrump, rank, 's'), 3);
});
