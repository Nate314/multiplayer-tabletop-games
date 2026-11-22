import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seeded } from '../testStates.ts';
import { dealLayout, fits, turnOnce, type BoardSize, type Layout } from './board.ts';
import { SHAPES } from './shapes.ts';

const period = (id: string) => SHAPES.find((s) => s.id === id)!.period;
const SIZES: BoardSize[] = [9, 16, 25];

test('SHAPES has 25 distinct shapes', () => {
  assert.equal(SHAPES.length, 25);
  assert.equal(new Set(SHAPES.map((s) => s.id)).size, 25);
  for (const s of SHAPES) assert.ok([1, 2, 4, 8].includes(s.period), s.id);
});

type Point = [number, number];
const isPolygon = (path: string) => /^[MLZ\d\s.,-]+$/.test(path);
const vertices = (path: string): Point[] => {
  const n = path.match(/-?\d+(\.\d+)?/g)!.map(Number);
  return Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i], n[2 * i + 1]] as Point);
};
const rotated = (points: Point[], steps: number): Point[] => {
  const a = (steps * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
  return points.map(([x, y]) => [50 + (x - 50) * c - (y - 50) * s, 50 + (x - 50) * s + (y - 50) * c]);
};
const sameSet = (a: Point[], b: Point[]) =>
  a.length === b.length && a.every(([x, y]) => b.some(([u, v]) => Math.hypot(x - u, y - v) < 0.1));

test('each polygon shape has exactly the period its path has', () => {
  for (const shape of SHAPES.filter((s) => isPolygon(s.path))) {
    const points = vertices(shape.path);
    for (let k = 1; k <= 8; k++) {
      const symmetric = sameSet(points, rotated(points, k));
      assert.equal(symmetric, k % shape.period === 0, `${shape.id} rotated ${k} steps`);
    }
  }
});

test('no two polygon shapes are the same shape turned', () => {
  const polygons = SHAPES.filter((s) => isPolygon(s.path));
  for (const [i, a] of polygons.entries()) for (const b of polygons.slice(i + 1)) {
    for (let k = 0; k < 8; k++) assert.ok(!sameSet(vertices(a.path), rotated(vertices(b.path), k)), `${a.id} is ${b.id} turned ${k}`);
  }
});

test('curved shapes carry their period by construction', () => {
  const curved = SHAPES.filter((s) => !isPolygon(s.path));
  assert.ok(curved.length > 0);
  const expected: Record<string, number> = { circle: 1, oval: 4 };
  for (const s of curved) assert.equal(s.period, expected[s.id] ?? 8, s.id);
});

test('dealLayout uses size distinct shapes in holes and tray', () => {
  for (const size of SIZES) {
    const layout = dealLayout(size, seeded(3));
    assert.equal(layout.holes.length, size);
    assert.equal(new Set(layout.holes).size, size);
    assert.deepEqual([...layout.tray].sort(), [...layout.holes].sort());
    assert.equal(layout.startTurns.length, size);
    for (const t of layout.startTurns) assert.ok(Number.isInteger(t) && t >= 0 && t <= 7);
  }
});

test('dealLayout never starts a shape already fitting unless it always fits', () => {
  for (const size of SIZES) for (let seed = 1; seed <= 20; seed++) {
    const layout = dealLayout(size, seeded(seed));
    layout.tray.forEach((id, i) => {
      if (period(id) > 1) assert.notEqual(layout.startTurns[i] % period(id), 0, id);
    });
  }
});

test('dealLayout is the same for the same seed', () => {
  assert.deepEqual(dealLayout(16, seeded(7)), dealLayout(16, seeded(7)));
});

const layoutWith = (holes: string[]): Layout => ({ size: 9, holes, tray: holes, startTurns: holes.map(() => 1) });

test('fits accepts the matching hole at any equivalent rotation', () => {
  const two = SHAPES.find((s) => s.period === 2)!.id;
  const one = SHAPES.find((s) => s.period === 1)!.id;
  const layout = layoutWith([two, one]);
  for (let t = 0; t < 8; t++) {
    assert.equal(fits(layout, {}, 0, 0, t), t % 2 === 0);
    assert.equal(fits(layout, {}, 1, 1, t), true);
  }
});

test('fits refuses a wrong hole', () => {
  const layout = layoutWith(['circle', 'octagon']);
  assert.equal(fits(layout, {}, 0, 1, 0), false);
});

test('fits refuses a filled hole and a placed shape', () => {
  const layout = layoutWith(['circle', 'octagon', 'square']);
  assert.equal(fits(layout, { 0: 2 }, 0, 0, 0), false);
  for (let hole = 0; hole < 3; hole++) assert.equal(fits(layout, { 0: 1 }, 1, hole, 0), false);
});

test('turnOnce wraps', () => {
  assert.equal(turnOnce(7), 0);
  assert.equal(turnOnce(3), 4);
});
