import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EDGE_SCROLL_MAX_PX, EDGE_SCROLL_ZONE_PX, edgeScrollStep } from './edgeScroll.ts';

const HEIGHT = 800;

test('away from the top and bottom edges the page does not scroll', () => {
  assert.equal(edgeScrollStep(EDGE_SCROLL_ZONE_PX, HEIGHT), 0);
  assert.equal(edgeScrollStep(400, HEIGHT), 0);
  assert.equal(edgeScrollStep(HEIGHT - EDGE_SCROLL_ZONE_PX, HEIGHT), 0);
});

test('near the top it scrolls up, near the bottom down', () => {
  assert.ok(edgeScrollStep(20, HEIGHT) < 0);
  assert.ok(edgeScrollStep(HEIGHT - 20, HEIGHT) > 0);
});

test('it scrolls faster the nearer the edge, up to a cap', () => {
  const steps = [39, 30, 20, 10, 0].map(y => -edgeScrollStep(y, HEIGHT));
  for (let index = 1; index < steps.length; index++) assert.ok(steps[index] > steps[index - 1], `${steps}`);
  assert.equal(edgeScrollStep(0, HEIGHT), -EDGE_SCROLL_MAX_PX);
  assert.equal(edgeScrollStep(-50, HEIGHT), -EDGE_SCROLL_MAX_PX); // a pointer above the window
  assert.equal(edgeScrollStep(HEIGHT + 50, HEIGHT), EDGE_SCROLL_MAX_PX);
  assert.ok(edgeScrollStep(39, HEIGHT) <= -1); // even at the zone's inner end it moves
});
