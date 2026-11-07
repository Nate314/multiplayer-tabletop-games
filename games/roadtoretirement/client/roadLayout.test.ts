import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROAD } from '../road.ts';
import { BOARD_HEIGHT, BOARD_WIDTH, SPACE_RADIUS, roadLayout } from './roadLayout.ts';

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
