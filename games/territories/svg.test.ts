import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landSvg } from './svg.ts';
import { CONTINENTS } from './map.ts';

test('the land has the sea and one land polygon per continent, in its continent group', () => {
  const svg = landSvg();
  assert.match(svg, /^<svg[^>]* viewBox="0 0 1000 620"/);
  assert.match(svg, /<rect class="sea"/);
  assert.equal(svg.match(/<polygon class="land"/g)?.length, CONTINENTS.length);
  for (const { id } of CONTINENTS) assert.ok(svg.includes(`<g class="continent continent-${id}"><polygon class="land"`), id);
});
