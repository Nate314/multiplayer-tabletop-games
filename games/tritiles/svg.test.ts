import { test } from 'node:test';
import assert from 'node:assert/strict';
import { triTileSvg } from './svg.ts';

test('a tile has its three corner numbers, up or down', () => {
  for (const up of ['up', 'down']) {
    const svg = triTileSvg('1', '2', '5', up)!;
    assert.match(svg, /^<svg/);
    assert.equal(svg.match(/<text/g)?.length, 3);
    assert.match(svg, />1<\/text>.*>2<\/text>.*>5<\/text>/);
    assert.match(svg, /--tile-pip/);
  }
});

test('a number outside 0 to 5, or an unknown orientation, is refused', () => {
  assert.equal(triTileSvg('6', '1', '1', 'up'), null);
  assert.equal(triTileSvg('a', '1', '1', 'up'), null);
  assert.equal(triTileSvg('1', '1', '1', 'left'), null);
});
