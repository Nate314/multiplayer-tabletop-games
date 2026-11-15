import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardValue, describeItems, matchCombination, pegItems, playable, scoreShow, totalOf } from './scoring.ts';
import type { Card, ScoreItem } from './types.ts';
import type { Rank, Suit } from './types.ts';

const SUIT_OF: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' };

// '5H' is the five of hearts, '10S' the ten of spades
function parse(text: string): Card[] {
  return text.split(' ').filter(Boolean).map(code => ({ rank: code.slice(0, -1) as Rank, suit: SUIT_OF[code.slice(-1)] }));
}
const one = (code: string): Card => parse(code)[0];
const item = (kind: ScoreItem['kind'], points: number): ScoreItem => ({ kind, cards: [], points });

test('cardValue: ace 1, faces 10, others face value', () => {
  assert.deepEqual((['A', '5', '10', 'J', 'Q', 'K'] as Rank[]).map(cardValue), [1, 5, 10, 10, 10, 10]);
});

const SHOWS: [string, string, string, boolean, number][] = [
  ['nobs counts', '5C 5D 5S JH', '5H', false, 29],
  ['no nobs when the jack is the wrong suit', '5H 5D 5S JH', '5C', false, 28],
  ['double run with a pair', '4H 5H 6H 6D', '2C', false, 12],
  ['run, flush and fifteens', 'AH 2H 3H 4H', 'KC', false, 12],
  ['nothing', '2C 4D 6H 8S', 'KD', false, 0],
  ['4-card flush in hand', 'AH 3H 7H 9H', 'KC', false, 4],
  ['4-card flush not in crib', 'AH 3H 7H 9H', 'KC', true, 0],
  ['5-card flush in crib', 'AH 3H 7H 9H', 'KH', true, 5],
  ['nobs only', 'JD 3C 7S 9H', '4D', false, 1],
];

for (const [name, hand, starter, crib, expected] of SHOWS) {
  test(`scoreShow: ${name}`, () => {
    assert.equal(totalOf(scoreShow(parse(hand), one(starter), crib)), expected);
  });
}

test('scoreShow: itemises fifteens, pair and runs', () => {
  const items = scoreShow(parse('4H 5H 6H 6D'), one('2C'), false);
  assert.deepEqual(items.map(i => i.kind).sort(), ['fifteen', 'fifteen', 'pair', 'run', 'run']);
});

test('describeItems', () => {
  assert.equal(describeItems([item('fifteen', 2), item('fifteen', 2), item('pair', 2)]), 'Fifteen two, fifteen four, and a pair is six');
  assert.equal(describeItems([]), 'No points');
});

const peg = (cards: string, count: number) => pegItems(parse(cards), count);

test('pegItems', () => {
  assert.deepEqual(peg('5H 10S', 15).map(i => [i.kind, i.points]), [['fifteen', 2]]);
  assert.deepEqual(peg('7H 7S 7D', 21).map(i => [i.kind, i.points]), [['pair', 6]]);
  assert.deepEqual(peg('4H 6S 5D', 15).map(i => i.kind).sort(), ['fifteen', 'run']);
  assert.deepEqual(peg('4H 6S 5D', 15).find(i => i.kind === 'run')?.points, 3);
  assert.equal(peg('4H 6S 5D 7C', 22).find(i => i.kind === 'run')?.points, 4);
  assert.deepEqual(peg('KH QS 10D AC', 31).map(i => [i.kind, i.points]), [['thirtyOne', 2]]);
  assert.deepEqual(peg('4H 5S 5D', 14).map(i => i.kind), ['pair']);
  assert.deepEqual(peg('4H 5S 5D 6C', 20), []);
  assert.deepEqual(peg('5H', 5), []);
});

test('playable', () => {
  assert.deepEqual(playable(parse('KH 5C'), 25), parse('5C'));
});

test('matchCombination', () => {
  const items = scoreShow(parse('5C 5D 2S 9H'), one('KD'), false);
  const pairAt = items.findIndex(i => i.kind === 'pair');
  assert.equal(matchCombination(items, parse('5D 5C'), []), pairAt);
  assert.equal(matchCombination(items, parse('5C 5D'), [pairAt]), null);
  assert.equal(matchCombination(items, parse('2S 9H'), []), null);
});
