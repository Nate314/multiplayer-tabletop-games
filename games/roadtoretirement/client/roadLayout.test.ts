import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROAD } from '../road.ts';
import { BOARD_HEIGHT, BOARD_WIDTH, SPACE_RADIUS, TOKEN_RADIUS, roadLayout, tokenSpot } from './roadLayout.ts';

test('every space has a position and no two overlap', () => {
  for (const vertical of [false, true]) {
    const points = roadLayout(vertical);
    assert.equal(points.length, ROAD.length);
    const [width, height] = vertical ? [BOARD_HEIGHT, BOARD_WIDTH] : [BOARD_WIDTH, BOARD_HEIGHT];
    points.forEach((p, i) => {
      assert.ok(p.x >= SPACE_RADIUS && p.x <= width - SPACE_RADIUS && p.y >= SPACE_RADIUS && p.y <= height - SPACE_RADIUS, `space ${i} on the board`);
      for (let j = 0; j < i; j++) {
        const gap = Math.hypot(p.x - points[j].x, p.y - points[j].y);
        assert.ok(gap >= 2 * SPACE_RADIUS, `spaces ${j} and ${i} are ${gap.toFixed(1)} apart`);
      }
    });
  }
});

// A label is level text of at most about 24 by 9 units, centered on its space
const coversLabel = (t: { x: number; y: number }, p: { x: number; y: number }): boolean =>
  Math.hypot(Math.max(Math.abs(t.x - p.x) - 12, 0), Math.max(Math.abs(t.y - p.y) - 4.5, 0)) < TOKEN_RADIUS;

test('tokens stay on the board, off their own space, apart from each other and off every label', () => {
  for (const vertical of [false, true]) {
    const points = roadLayout(vertical);
    const [width, height] = vertical ? [BOARD_HEIGHT, BOARD_WIDTH] : [BOARD_WIDTH, BOARD_HEIGHT];
    for (let count = 1; count <= 6; count++) {
      ROAD.forEach((_, space) => {
        const spots = Array.from({ length: count }, (_, i) => tokenSpot(space, i, count, vertical));
        spots.forEach((t, i) => {
          const where = `token ${i} of ${count} at space ${space}`;
          assert.ok(t.x >= TOKEN_RADIUS && t.x <= width - TOKEN_RADIUS && t.y >= TOKEN_RADIUS && t.y <= height - TOKEN_RADIUS, `${where} on the board`);
          assert.ok(Math.hypot(t.x - points[space].x, t.y - points[space].y) > SPACE_RADIUS + TOKEN_RADIUS, `${where} covers its space`);
          points.forEach((p, j) => {
            assert.ok(!coversLabel(t, p), `${where} covers the label of space ${j}`);
            // One or two tokens on a space leave every other space clear too
            if (count <= 2) assert.ok(Math.hypot(t.x - p.x, t.y - p.y) > SPACE_RADIUS + TOKEN_RADIUS, `${where} covers space ${j}`);
          });
          spots.slice(0, i).forEach((u, k) => assert.ok(Math.hypot(t.x - u.x, t.y - u.y) >= 2 * TOKEN_RADIUS, `tokens ${k} and ${i} of ${count} at space ${space}`));
        });
      });
    }
  }
});
