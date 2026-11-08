import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landSvg } from './svg.ts';

test('the land is the sea, Canada and the United States on the map view box', () => {
  const svg = landSvg();
  assert.match(svg, /^<svg[^>]* viewBox="-50 0 1110 630"/);
  assert.match(svg, /<rect class="sea" x="-50"/);
  assert.match(svg, /<polygon class="land canada" points="-50,0 1060,0 /);
  assert.match(svg, /<polygon class="land usa" points="28,100 58,87 /);
});
