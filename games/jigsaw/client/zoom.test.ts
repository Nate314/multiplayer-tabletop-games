import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepCentre } from './zoom.ts';

test('zooming keeps the middle of the view on the same point', () => {
  // A 400 wide view at 1x shows 0..400, its middle 200; at 2x that point is 400, so the view starts at 200
  assert.equal(keepCentre(0, 400, 1, 2), 200);
  assert.equal(keepCentre(200, 400, 2, 3), 400);
  assert.equal(keepCentre(400, 400, 3, 2), 200);
  assert.equal(keepCentre(200, 400, 2, 1), 0);
});
