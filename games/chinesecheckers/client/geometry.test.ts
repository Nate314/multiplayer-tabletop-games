import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holeXY, turnsFor } from './geometry.ts';
import { POINT_HOLES } from '../board.ts';

test('point 0 is at the bottom unturned', () => {
  assert.ok(POINT_HOLES[0].every(hole => holeXY(hole, 0).y > 0));
});

test('each viewer sees their own start point at the bottom', () => {
  const points = { 1: 0 as const, 2: 3 as const };
  const turns = turnsFor(points, 2);
  assert.ok(POINT_HOLES[3].every(hole => holeXY(hole, turns).y > 0));
  assert.ok(POINT_HOLES[0].every(hole => holeXY(hole, turnsFor(points, 1)).y > 0));
  // An odd point turns too: point 1 starts lower left
  assert.ok(POINT_HOLES[1].every(hole => Math.abs(holeXY(hole, turnsFor({ 3: 1 }, 3)).x) < 3.5 && holeXY(hole, turnsFor({ 3: 1 }, 3)).y > 0));
});

test('null sees the table unturned', () => {
  assert.equal(turnsFor({ 1: 3, 2: 0 }, null), 0);
  assert.equal(turnsFor({ 1: 3, 2: 0 }, 5), 0); // a spectator seat with no point
});
