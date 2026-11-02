import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOLES, POINT_HOLES, holeKey, isHole, neighbors, opposite, parseHole, pointOf } from './board.ts';
import type { PointIndex } from './types.ts';

const POINTS: PointIndex[] = [0, 1, 2, 3, 4, 5];

test('the star has 121 holes', () => {
  assert.equal(HOLES.length, 121);
  assert.equal(new Set(HOLES.map(holeKey)).size, 121);
  assert.ok(HOLES.every(isHole));
  assert.equal(isHole({ q: 4, r: -9 }), false);
  assert.deepEqual(parseHole(holeKey({ q: 3, r: -7 })), { q: 3, r: -7 });
});

test('each point has 10 holes and the center 61', () => {
  for (const point of POINTS) {
    assert.equal(POINT_HOLES[point].length, 10);
    assert.ok(POINT_HOLES[point].every(hole => pointOf(hole) === point));
  }
  assert.equal(HOLES.filter(hole => pointOf(hole) === null).length, 61);
});

test('points are numbered clockwise and opposite is three on', () => {
  // The tip of each point, clockwise from the bottom (r grows downward)
  const tips = [{ q: -4, r: 8 }, { q: -8, r: 4 }, { q: -4, r: -4 }, { q: 4, r: -8 }, { q: 8, r: -4 }, { q: 4, r: 4 }];
  assert.deepEqual(tips.map(pointOf), POINTS);
  assert.equal(opposite(0), 3);
  assert.equal(opposite(4), 1);
  assert.ok(POINTS.every(point => opposite(opposite(point)) === point));
});

test('every hole has at most six neighbors and the center hole has six', () => {
  assert.ok(HOLES.every(hole => neighbors(hole).length <= 6 && neighbors(hole).every(isHole)));
  assert.equal(neighbors({ q: 0, r: 0 }).length, 6);
  assert.equal(neighbors({ q: -4, r: 8 }).length, 2);
});
