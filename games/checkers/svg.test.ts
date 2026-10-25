import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crownSvg } from './svg.ts';

test('the crown paints with --crown', () => {
  assert.match(crownSvg(), /^<svg/);
  assert.match(crownSvg(), /fill: var\(--crown, #FFD54F\)/);
});
