import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slideOffset } from './motion.ts';

test('slideOffset is center to center', () =>
  assert.deepEqual(slideOffset({ x: 0, y: 0, width: 10, height: 10 }, { x: 100, y: 50, width: 10, height: 10 }, 1), { x: -100, y: -50 }));

test('slideOffset divides the distance by the board scale', () =>
  assert.deepEqual(slideOffset({ x: 0, y: 0, width: 10, height: 10 }, { x: 100, y: 50, width: 10, height: 10 }, 0.5), { x: -200, y: -100 }));
