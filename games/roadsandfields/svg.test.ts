import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meepleSvg, tileSvg } from './svg.ts';

test('a city tile turned once has the city path inside the turned group', () => {
  const svg = tileSvg('E', '1')!;
  assert.match(svg, /^<svg/);
  assert.match(svg, /<g class="cc-tile-art" transform="rotate\(90 50 50\)">/);
  assert.match(svg, /<path class="cc-city" d="M0,0 H100 Q50,60 0,0 Z"\/>/);
  assert.match(svg, /class="cc-tile-edge"/);
});

test('an unturned tile has no transform, and a pennant is turned back upright', () => {
  assert.match(tileSvg('D', '0')!, /<g class="cc-tile-art">/);
  assert.match(tileSvg('C', '2')!, /<g transform="rotate\(-180 24 24\)"><g class="cc-pennant"/);
});

test('roads, junctions and the monastery are drawn', () => {
  assert.equal(tileSvg('X', '0')!.match(/class="cc-road"/g)?.length, 4);
  assert.match(tileSvg('X', '0')!, /cc-junction/);
  assert.match(tileSvg('A', '0')!, /cc-monastery/);
});

test('an unknown tile or a turn outside 0 to 3 is refused', () => {
  assert.equal(tileSvg('Z', '0'), null);
  assert.equal(tileSvg('E', '4'), null);
  assert.equal(tileSvg('toString', '0'), null);
});

test('a meeple is in its seat color, a farmer lies down, and only seats 1 to 5 exist', () => {
  assert.match(meepleSvg('3', 'standing')!, /<path class="cc-meeple cc-seat3" d="[^"]+"\/>/);
  assert.match(meepleSvg('3', 'lying')!, /transform="rotate\(-90\)"/);
  assert.equal(meepleSvg('6', 'standing'), null);
  assert.equal(meepleSvg('1', 'sitting'), null);
});
