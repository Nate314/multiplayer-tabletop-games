import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landSvg } from './svg.ts';

test('the land is the sea and the land of a fictional continent on the map view box', () => {
  const svg = landSvg();
  assert.match(svg, /^<svg[^>]* viewBox="-50 0 1110 630"/);
  assert.match(svg, /<rect class="sea" x="-50"/);
  assert.match(svg, /<polygon class="land" points="/);
  // Only the sea, the land and the lake: no named country of the old map
  assert.deepEqual([...new Set(svg.match(/class="[^"]*"/g))], ['class="sea"', 'class="land"', 'class="lake"']);
});
