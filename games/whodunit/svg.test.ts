import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS } from './content.ts';
import { WHODUNIT_ASSETS } from './svg.ts';

const card = WHODUNIT_ASSETS.find(asset => asset.name === 'whodunit-card')!;

test('every card has art', () => {
  assert.deepEqual(card.samples, CARDS.map(id => [id]));
  for (const id of CARDS) assert.match(card.render([id]) ?? '', /^<svg/, id);
});

test('an unknown card renders null', () => {
  assert.equal(card.render(['nobody']), null);
});
