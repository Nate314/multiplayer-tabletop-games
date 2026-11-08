import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardSvg } from './svg.ts';

test('a colored card paints with its --card variable and carries the white circle', () => {
  const red = cardSvg('red')!;
  assert.match(red, /^<svg/);
  assert.match(red, /fill: var\(--card-red, #d72600\)/);
  assert.match(red, /<circle[^>]*cx="50" cy="75" r="36" style="fill: #fff"/);
});

test('a wild is four quarters and the back is dark with a red circle', () => {
  assert.equal(cardSvg('wild')!.match(/<polygon/g)?.length, 4);
  assert.match(cardSvg('back')!, /--card-dark/);
  assert.match(cardSvg('back')!, /<circle[^>]*fill: var\(--card-red/);
});

test('an unknown card is refused', () => {
  assert.equal(cardSvg('purple'), null);
});
