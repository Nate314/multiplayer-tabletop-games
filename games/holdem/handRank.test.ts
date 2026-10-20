import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestHand, compareHands } from './handRank.ts';
import type { PlayingCard, Rank, Suit } from '../../shared/playingCards.ts';

const SUIT: Record<string, Suit> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' };
// 'Ah Kd 10c' style card lists
const cards = (text: string): PlayingCard[] =>
  text.split(' ').map(code => ({ rank: code.slice(0, -1) as Rank, suit: SUIT[code.slice(-1)] }));
const best = (text: string) => bestHand(cards(text));

test('hand ranking orders every category and breaks ties by kickers', () => {
  // Weakest to strongest, one hand per category, each from seven cards
  const ladder = [
    ['Ah Qd 9c 7s 5h 3d 2c', 'High card, ace'],
    ['2h 2d 9c 7s 5h 3d Kc', 'Pair of twos'],
    ['2h 2d 3c 3s 5h 9d Kc', 'Two pair, threes and twos'],
    ['7h 7d 7c 2s 5h 9d Kc', 'Three of a kind, sevens'],
    ['Ah 2d 3c 4s 5h 9d Kc', 'Straight, five high'],
    ['6h 2d 3c 4s 5h 9d Kc', 'Straight, six high'],
    ['10h Jd Qc Ks Ah 2d 2c', 'Straight, ace high'],
    ['2h 5h 7h 9h Jh Kd Kc', 'Flush, jack high'],
    ['2h 2d 2c 3s 3h 9d Kc', 'Full house, twos over threes'],
    ['2h 2d 2c 2s 3h 9d Kc', 'Four of a kind, twos'],
    ['Ah 2h 3h 4h 5h 9d Kc', 'Straight flush, five high'],
    ['9h 10h Jh Qh Kh 2d 3c', 'Straight flush, king high'],
    ['10s Js Qs Ks As 2d 3c', 'Royal flush']
  ] as const;
  const hands = ladder.map(([text, name]) => {
    const hand = best(text);
    assert.equal(hand.name, name);
    return hand;
  });
  for (let i = 1; i < hands.length; i++) assert.ok(compareHands(hands[i], hands[i - 1]) > 0, `${hands[i].name} beats ${hands[i - 1].name}`);

  // The wheel A-2-3-4-5 is the lowest straight, below 2-3-4-5-6
  assert.deepEqual(best('Ah 2d 3c 4s 5h 9d Kc').tiebreak, [5]);
  // Kickers: the pair of kings with an ace beats the pair of kings with a queen
  assert.ok(compareHands(best('Kh Kd Ac 7s 5h 3d 2c'), best('Kh Kd Qc 7s 5h 3d 2c')) > 0);
  // Only five cards count: the sixth and seventh cards do not break a tie
  assert.equal(compareHands(best('Kh Kd Ac 9s 8h 3d 2c'), best('Kc Ks Ad 9c 8d 4h 3s')), 0);
  // Two pair: the higher pair first, then the lower, then the kicker
  assert.ok(compareHands(best('Ah Ad 3c 3s 5h 9d Kc'), best('Kh Kd Qc Qs 5h 9d 2c')) > 0);
  assert.ok(compareHands(best('Ah Ad 3c 3s Qh 9d 2c'), best('Ah Ad 3c 3s Jh 9d 2c')) > 0);
  // The best two pair of three pairs
  assert.equal(best('Ah Ad 3c 3s 5h 5d Kc').name, 'Two pair, aces and fives');
  // A full house picks the best three, then the best pair from two trips
  assert.equal(best('2h 2d 2c 3s 3h 3d Kc').name, 'Full house, threes over twos');
  // Flushes compare all five cards; suits never matter
  assert.ok(compareHands(best('Ah 9h 7h 5h 3h 2d 2c'), best('Ah 9h 7h 5h 2h Kd Kc')) > 0);
  assert.equal(compareHands(best('Ah Kd Qc Js 9h 3d 2c'), best('As Kh Qd Jc 9s 3c 2d')), 0);
  // Quads with the best kicker
  assert.deepEqual(best('2h 2d 2c 2s 3h 9d Kc').tiebreak, [2, 13]);
});

test('a hand of five or six cards is ranked too', () => {
  assert.equal(best('Ah Ad Ac 2s 2h').name, 'Full house, aces over twos');
  assert.equal(best('Ah Ad Ac 2s 2h 3c').category, 6);
});
