import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardName, rankValue, sameCard, standardDeck, SUITS } from './playingCards.ts';

test('standard deck has 52 different cards, 13 per suit', () => {
  const deck = standardDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map(card => `${card.rank}${card.suit}`)).size, 52);
  for (const suit of SUITS) assert.equal(deck.filter(card => card.suit === suit).length, 13);
});

test('rankValue orders aces by the flag', () => {
  assert.equal(rankValue('A', true), 14);
  assert.equal(rankValue('A', false), 1);
  assert.equal(rankValue('K', true), 13);
  assert.equal(rankValue('2', false), 2);
});

test('cardName spells out face cards', () => {
  assert.equal(cardName({ suit: 'spades', rank: 'A' }), 'ace of spades');
  assert.equal(cardName({ suit: 'hearts', rank: '10' }), '10 of hearts');
  assert.equal(cardName({ suit: 'clubs', rank: 'Q' }), 'queen of clubs');
});

test('sameCard compares suit and rank', () => {
  assert.ok(sameCard({ suit: 'clubs', rank: '7' }, { suit: 'clubs', rank: '7' }));
  assert.ok(!sameCard({ suit: 'clubs', rank: '7' }, { suit: 'spades', rank: '7' }));
});
