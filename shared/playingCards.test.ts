import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardName, isJoker, rankValue, sameCard, standardDeck, SUITS } from './playingCards.ts';

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

test('the default deck is unchanged', () => {
  const deck = standardDeck();
  assert.equal(deck.length, 52);
  assert.deepEqual(deck[0], { suit: 'clubs', rank: 'A' });
  assert.deepEqual(deck[51], { suit: 'spades', rank: 'K' });
});

test("ranks filter keeps Euchre's 24", () => {
  const deck = standardDeck({ ranks: ['9', '10', 'J', 'Q', 'K', 'A'] });
  assert.equal(deck.length, 24);
  assert.ok(deck.every(card => ['9', '10', 'J', 'Q', 'K', 'A'].includes(card.rank)));
  assert.deepEqual(deck[0], { suit: 'clubs', rank: 'A' });
});

test('suits filter keeps one suit', () => {
  const deck = standardDeck({ suits: ['hearts'] });
  assert.equal(deck.length, 13);
  assert.ok(deck.every(card => card.suit === 'hearts'));
});

test('jokers are appended and named', () => {
  const deck = standardDeck({ jokers: 2 });
  assert.equal(deck.length, 54);
  assert.deepEqual(deck.slice(52), [{ joker: 1 }, { joker: 2 }]);
  assert.ok(isJoker(deck[53]) && !isJoker(deck[0]));
  assert.equal(cardName(deck[53]), 'joker');
});

test('jokers compare by index', () => {
  assert.ok(sameCard({ joker: 1 }, { joker: 1 }));
  assert.ok(!sameCard({ joker: 1 }, { joker: 2 }));
  assert.ok(!sameCard({ joker: 1 }, { suit: 'clubs', rank: 'A' }));
});
