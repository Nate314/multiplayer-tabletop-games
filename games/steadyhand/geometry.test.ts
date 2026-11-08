import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Part, Point } from './types.ts';
import { PARTS } from './board.ts';
import { TOLERANCE } from './options.ts';
import { checkStep, clearance, distanceToPath, pathLength } from './geometry.ts';

const along = (from: Point, to: Point, d: number): Point => {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return [from[0] + (to[0] - from[0]) * d / length, from[1] + (to[1] - from[1]) * d / length];
};
// The point d units to the side of a's segment towards b, level with a
const aside = (a: Point, b: Point, d: number): Point => {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [a[0] - (b[1] - a[1]) * d / length, a[1] + (b[0] - a[0]) * d / length];
};

const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function segmentDistance(a: Point, b: Point, c: Point, d: Point): number {
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(distanceToPath([c, d], a), distanceToPath([c, d], b), distanceToPath([a, b], c), distanceToPath([a, b], d));
}
const segments = (part: Part) => part.path.slice(1).map((p, i): [Point, Point] => [part.path[i], p]);
const reach = (part: Part) => 2 * (part.width / 2 * TOLERANCE.easy);

test('moving along the middle of a slot to its exit is out', () => {
  for (const part of PARTS) {
    const results = segments(part).map(([from, to]) => checkStep(part, from, to, TOLERANCE.normal));
    assert.deepEqual(results, [...results.slice(0, -1).map(() => 'inside'), 'out'], part.name);
  }
});

test('a step past the wall buzzes', () => {
  for (const part of PARTS) {
    const [a, b] = part.path;
    assert.equal(checkStep(part, a, aside(a, b, clearance(part, TOLERANCE.normal) + 1), TOLERANCE.normal), 'buzz', part.name);
  }
});

test('a jump across a wall between samples buzzes', () => {
  for (const part of PARTS) {
    const [a, corner, b] = part.path;
    const d = 0.9 * Math.min(pathLength([a, corner]), pathLength([corner, b]));
    const from = along(corner, a, d), to = along(corner, b, d);
    assert.equal(checkStep(part, corner, from, TOLERANCE.normal), 'inside', part.name);
    assert.equal(checkStep(part, corner, to, TOLERANCE.normal), 'inside', part.name);
    assert.equal(checkStep(part, from, to, TOLERANCE.normal), 'buzz', part.name);
  }
});

test('Easy widens and Hard narrows', () => {
  for (const part of PARTS) {
    const [a, b] = part.path;
    const p = aside(a, b, clearance(part, TOLERANCE.normal) + 2);
    assert.ok(Math.abs(distanceToPath(part.path, p) - (clearance(part, TOLERANCE.normal) + 2)) < 1e-9, part.name);
    assert.equal(checkStep(part, a, p, TOLERANCE.easy), 'inside', part.name);
    assert.equal(checkStep(part, a, p, TOLERANCE.normal), 'buzz', part.name);
    const q = aside(a, b, clearance(part, TOLERANCE.hard) + 1);
    assert.equal(checkStep(part, a, q, TOLERANCE.normal), 'inside', part.name);
    assert.equal(checkStep(part, a, q, TOLERANCE.hard), 'buzz', part.name);
  }
});

test('slots never come close enough to shortcut', () => {
  for (const part of PARTS) {
    const s = segments(part);
    for (let i = 0; i < s.length; i++) {
      for (let j = i + 2; j < s.length; j++) {
        assert.ok(segmentDistance(...s[i], ...s[j]) > reach(part), `${part.name} segments ${i} and ${j}`);
      }
    }
  }
  for (const [n, one] of PARTS.entries()) {
    for (const other of PARTS.slice(n + 1)) {
      const apart = Math.min(...segments(one).flatMap(([a, b]) => segments(other).map(([c, d]) => segmentDistance(a, b, c, d))));
      assert.ok(apart > Math.max(reach(one), reach(other)), `${one.name} and ${other.name}`);
    }
  }
});

test('every slot fits the board with 3 to 9 points', () => {
  for (const part of PARTS) {
    assert.ok(part.path.length >= 3 && part.path.length <= 9, part.name);
    assert.ok(part.width >= 34 && part.width <= 60 && part.value >= 5 && part.value <= 40, part.name);
    for (const [x, y] of part.path) assert.ok(x >= 0 && x <= 1000 && y >= 0 && y <= 640, part.name);
  }
  assert.deepEqual(PARTS.map(p => p.id), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('harder parts score more', () => {
  const sorted = [...PARTS].sort((a, b) => pathLength(a.path) / a.width - pathLength(b.path) / b.width);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].value >= sorted[i - 1].value, `${sorted[i - 1].name} then ${sorted[i].name}`);
});
