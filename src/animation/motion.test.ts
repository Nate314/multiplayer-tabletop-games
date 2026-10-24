import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardScale, slideOffset } from './motion.ts';

test('slideOffset is center to center', () =>
  assert.deepEqual(slideOffset({ x: 0, y: 0, width: 10, height: 10 }, { x: 100, y: 50, width: 10, height: 10 }, 1), { x: -100, y: -50 }));

test('slideOffset divides the distance by the board scale', () =>
  assert.deepEqual(slideOffset({ x: 0, y: 0, width: 10, height: 10 }, { x: 100, y: 50, width: 10, height: 10 }, 0.5), { x: -200, y: -100 }));

// A stand-in for an element: closest() finds the scaled board, or nothing outside one
const inBoard = (fitScale: string | null) => ({ closest: () => (fitScale === null ? null : { dataset: { fitScale } }) }) as unknown as Element;

test('boardScale reads the scale of the board the element is in', () => assert.equal(boardScale(inBoard('0.5')), 0.5));

test('boardScale is 1 outside a scaled board', () => assert.equal(boardScale(inBoard(null)), 1));
