import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHAPE_PATHS, symbolSvg } from './symbols.ts';
import { iconSvg } from './icons.ts';

test('a symbol is its shape path in a 24 unit box, with no fill of its own', () => {
  const svg = symbolSvg('ring')!;
  assert.match(svg, /^<svg[^>]* viewBox="0 0 24 24"/);
  assert.ok(svg.includes(`d="${SHAPE_PATHS.ring}"`));
  assert.match(svg, /fill-rule="evenodd"/);
  assert.doesNotMatch(svg, / fill=/);
});

test('an unknown shape is refused', () => {
  assert.equal(symbolSvg('blob'), null);
  assert.equal(symbolSvg('constructor'), null);
});

test('the share and GitHub icons paint with currentColor', () => {
  assert.match(iconSvg('share')!, /^<svg[^>]*stroke="currentColor"/);
  assert.equal(iconSvg('share')!.match(/<circle/g)?.length, 3);
  assert.match(iconSvg('github')!, /^<svg[^>]*fill="currentColor"/);
  assert.equal(iconSvg('nope'), null);
});
