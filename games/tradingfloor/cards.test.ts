import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Random } from '../../shared/types.ts';
import type { Card, Commodity } from './types.ts';
import { COMMODITIES, cornerOf, deal, offerError } from './cards.ts';

function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let nextId = 0;
const cards = (kind: Card['kind'], n: number): Card[] => Array.from({ length: n }, () => ({ id: nextId++, kind }));
const ids = (hand: Card[]) => hand.map(c => c.id);

test('three players deal three commodities, 9 each, 9 cards a hand', () => {
  const hands = deal([1, 2, 3], 1, false, seeded(1));
  const all = [1, 2, 3].flatMap(s => hands[s]!);
  for (const s of [1, 2, 3]) assert.equal(hands[s]!.length, 9);
  assert.equal(new Set(all.map(c => c.id)).size, 27);
  assert.deepEqual([...new Set(all.map(c => c.kind))].sort(), ['saffron', 'silver', 'coffee'].sort());
  for (const k of ['saffron', 'silver', 'coffee']) assert.equal(all.filter(c => c.kind === k).length, 9);
});

test('with Bull and Bear two hands hold 10 and the deck 29', () => {
  const hands = deal([1, 2, 3], 1, true, seeded(2));
  const sizes = [1, 2, 3].map(s => hands[s]!.length);
  assert.deepEqual(sizes, [10, 10, 9]);
  const all = [1, 2, 3].flatMap(s => hands[s]!);
  assert.equal(all.length, 29);
  assert.equal(all.filter(c => c.kind === 'bull').length, 1);
  assert.equal(all.filter(c => c.kind === 'bear').length, 1);
});

test('the dealer rotates by round', () => {
  const sizes = (round: number) => {
    const h = deal([1, 2, 3], round, true, seeded(3));
    return [1, 2, 3].map(s => h[s]!.length);
  };
  assert.deepEqual(sizes(1), [10, 10, 9]);
  assert.deepEqual(sizes(2), [9, 10, 10]);
});

test('an offer is 1 to 4 own cards of one commodity, with the Bull or Bear riding along', () => {
  const soy = cards('soy', 5), sugar = cards('sugar', 1), bull = cards('bull', 1), bear = cards('bear', 1);
  const hand = [...soy, ...sugar, ...bull, ...bear];
  assert.equal(offerError(hand, ids(soy.slice(0, 4))), null);
  assert.equal(offerError(hand, ids(soy)), 'Offer 1 to 4 cards');
  assert.equal(offerError(hand, [soy[0].id, sugar[0].id]), 'Offer cards of one commodity');
  assert.equal(offerError(hand, [...ids(soy.slice(0, 3)), bear[0].id]), null);
  assert.equal(offerError(hand, ids(bull)), null);
  assert.equal(offerError(hand, [9999]), 'Those are not your cards');
  assert.equal(offerError(hand, [soy[0].id, soy[0].id]), 'Offer 1 to 4 cards');
  assert.equal(offerError(hand, 'x'), 'Offer 1 to 4 cards');
  assert.equal(offerError(hand, []), 'Offer 1 to 4 cards');
});

test('corners: 9, 8 plus the Bull, 9 plus the Bull doubles, never with the Bear', () => {
  const s = (n: number) => cards('saffron', n);
  assert.deepEqual(cornerOf(s(9)), { commodity: 'saffron', points: 100, double: false });
  assert.deepEqual(cornerOf([...s(8), ...cards('bull', 1)]), { commodity: 'saffron', points: 100, double: false });
  assert.deepEqual(cornerOf([...s(9), ...cards('bull', 1)]), { commodity: 'saffron', points: 200, double: true });
  assert.equal(cornerOf([...s(9), ...cards('bear', 1)]), null);
  assert.equal(cornerOf(s(8)), null);
});

test('commodity values are all different', () => {
  const values = COMMODITIES.map(c => c.value);
  assert.equal(new Set(values).size, values.length);
  assert.equal(COMMODITIES.length, 8);
  const kinds: Commodity[] = COMMODITIES.map(c => c.kind);
  assert.equal(new Set(kinds).size, 8);
});
