import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOORS, STARTS, isCorridor } from './board.ts';
import type { Cell, Position } from './board.ts';
import { destinations } from './movement.ts';

const start = Object.values(STARTS)[0];
const doorOf = DOORS[0];
const corridorNeighbours = (c: Cell): Cell[] =>
  [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([r, d]) => ({ row: c.row + r, col: c.col + d })).filter(isCorridor);
const same = (a: Cell, b: Cell) => a.row === b.row && a.col === b.col;

test('a corridor move uses the whole roll', () => {
  const result = destinations(start, 2, [], null);
  assert.ok(result.length > 0);
  const near = corridorNeighbours(start);
  for (const p of result) {
    if ('room' in p) {
      assert.ok(DOORS.some(d => d.room === p.room && near.some(n => same(n, d.outside))), 'room door is 1 step away');
    } else {
      assert.ok(isCorridor(p) && !same(p, start));
      assert.ok(near.some(n => corridorNeighbours(n).some(m => same(m, p))), 'exactly two steps away');
    }
  }
  assert.equal(new Set(result.map(p => JSON.stringify(p))).size, result.length);
});

test('a door within the roll lets the token enter early', () => {
  assert.ok(destinations(doorOf.outside, 6, [], null).some(p => 'room' in p && p.room === doorOf.room));
});

test('an occupied cell blocks the path', () => {
  assert.deepEqual(destinations(start, 3, corridorNeighbours(start), null), []);
});

test('leaving a room starts at its doors and cannot come straight back in', () => {
  const room = doorOf.room;
  const outsides = DOORS.filter(d => d.room === room).map(d => d.outside);
  const result = destinations({ room }, 1, [outsides[0]], null);
  assert.deepEqual(result, outsides.slice(1));
  assert.ok(!destinations({ room }, 2, [], room).some((p: Position) => 'room' in p && p.room === room));
});

test('all doors blocked leaves no destination', () => {
  const outsides = DOORS.filter(d => d.room === doorOf.room).map(d => d.outside);
  assert.deepEqual(destinations({ room: doorOf.room }, 5, outsides, null), []);
});
