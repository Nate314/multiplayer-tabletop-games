import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dieSvg } from './dice.ts';
import { backSvg, cardSvg, jokerSvg } from './playingCards.ts';

test('a die has as many pips as its value, painted with --dice-pip', () => {
  for (const value of [1, 2, 3, 4, 5, 6]) assert.equal(dieSvg(String(value))!.match(/<circle/g)?.length, value);
  assert.match(dieSvg('5')!, /fill: var\(--dice-pip, var\(--dice-pip-default/);
  assert.equal(dieSvg('7'), null);
  assert.equal(dieSvg('0'), null);
});

test('a red suit uses --playing-card-red and a black suit --playing-card-black', () => {
  const heart = cardSvg('Q', 'hearts')!;
  assert.match(heart, /^<svg/);
  assert.match(heart, /--playing-card-red/);
  assert.ok(heart.includes('>Q♥</text>'));
  assert.match(cardSvg('10', 'spades')!, /--playing-card-black/);
});

test('an unknown rank or suit is refused', () => {
  assert.equal(cardSvg('1', 'hearts'), null);
  assert.equal(cardSvg('A', 'stars'), null);
});

test('the joker spells JOKER and the back paints with the back and stripe colors', () => {
  assert.equal(jokerSvg().match(/<text/g)?.length, 7);
  assert.match(backSvg(), /--playing-card-back/);
  assert.match(backSvg(), /--playing-card-stripe/);
});
