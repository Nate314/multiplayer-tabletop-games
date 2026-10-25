import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wallSvg } from './svg.ts';

test('a wall stretches to its box and paints with --wall', () => {
  assert.match(wallSvg(), /^<svg/);
  assert.match(wallSvg(), /preserveAspectRatio="none"/);
  assert.match(wallSvg(), /var\(--qd-wall-fill, var\(--wall/);
});
