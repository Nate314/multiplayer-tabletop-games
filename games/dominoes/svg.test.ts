import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dominoSvg } from './svg.ts';

test('a domino has the pips of both halves and a center line', () => {
  const svg = dominoSvg('3', '9')!;
  assert.match(svg, /^<svg/);
  assert.equal(svg.match(/<circle/g)?.length, 12);
  assert.match(svg, /<line/);
  assert.match(svg, /--tile-pip/);
  assert.equal(dominoSvg('0', '0')!.match(/<circle/g), null);
});

test('a half outside 0 to 9 is refused', () => {
  assert.equal(dominoSvg('10', '1'), null);
  assert.equal(dominoSvg('a', '1'), null);
});
