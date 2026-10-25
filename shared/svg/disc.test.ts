import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discSvg } from './disc.ts';

test('the disc paints with the variables a game sets on the piece', () => {
  const svg = discSvg();
  assert.match(svg, /^<svg[^>]* viewBox="0 0 100 100"/);
  assert.match(svg, /fill: var\(--disc-fill, #9e9e9e\)/);
  assert.match(svg, /stroke: var\(--disc-edge,/);
  assert.match(svg, /stroke-width: var\(--disc-edge-width, 6\)/);
});
