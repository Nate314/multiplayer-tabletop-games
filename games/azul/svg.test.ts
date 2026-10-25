import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileSvg } from './svg.ts';

test('a tile is its color with its own mark, or plain for the color-blind symbol to sit on', () => {
  const red = tileSvg('red', 'mark')!;
  assert.match(red, /^<svg/);
  assert.match(red, /fill="#d6392e"/);
  assert.ok(red.includes('>▲</text>'));
  assert.doesNotMatch(tileSvg('red', 'plain')!, /<text/);
  assert.ok(tileSvg('first', 'mark')!.includes('>1</text>'));
});

test('an unknown color or style is refused', () => {
  assert.equal(tileSvg('green', 'mark'), null);
  assert.equal(tileSvg('red', 'bold'), null);
});
