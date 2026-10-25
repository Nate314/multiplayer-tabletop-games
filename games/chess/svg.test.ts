import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pieceSvg } from './svg.ts';

test('a piece is drawn as shapes, white with a dark outline and black with a light one', () => {
  const king = pieceSvg('white', 'king')!;
  assert.match(king, /^<svg[^>]* fill="#FFFFFF" stroke="#000000"/);
  assert.match(king, /<path/);
  assert.doesNotMatch(king, /<text/);
  assert.match(pieceSvg('black', 'knight')!, /fill="#1A1A1A" stroke="rgba\(255, 255, 255, 0.9\)"/);
});

test('an unknown color or piece is refused', () => {
  assert.equal(pieceSvg('red', 'king'), null);
  assert.equal(pieceSvg('white', 'archbishop'), null);
});
