import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motifSvg, pieceSvg } from './svg.ts';

test('a terrain motif keeps the classes the board colors', () => {
  const wood = motifSvg('wood')!;
  assert.match(wood, /^<svg[^>]* viewBox="-20 -20 40 40"/);
  assert.match(wood, /<g class="motif motif-wood">/);
  assert.equal(wood.match(/<polygon/g)?.length, 3);
  assert.match(motifSvg('desert')!, /class="motif motif-desert"/);
});

test('the settlement, city and robber are drawn around their point', () => {
  assert.match(pieceSvg('settlement')!, /<polygon points="0,-11 /);
  assert.match(pieceSvg('city')!, /<polygon/);
  assert.match(pieceSvg('robber')!, /<circle cx="0" cy="-10"/);
});

test('an unknown terrain or piece is refused', () => {
  assert.equal(motifSvg('gold'), null);
  assert.equal(pieceSvg('castle'), null);
});
