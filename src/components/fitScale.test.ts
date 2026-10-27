import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitScale, nextScale } from './fitScale.ts';

test('a board that fits is not scaled', () => assert.equal(fitScale({ width: 400, height: 300 }, { width: 800, height: 600 }), 1));

test('a board too wide or too tall shrinks to the tighter side', () => {
  assert.equal(fitScale({ width: 1000, height: 300 }, { width: 500, height: 600 }), 0.5);
  assert.equal(fitScale({ width: 400, height: 1200 }, { width: 800, height: 600 }), 0.5);
});

test('a board grows up to max', () => {
  assert.equal(fitScale({ width: 100, height: 50 }, { width: 400, height: 400 }, 4), 4);
  assert.equal(fitScale({ width: 100, height: 50 }, { width: 400, height: 400 }, 3), 3);
  assert.equal(fitScale({ width: 100, height: 50 }, { width: 400, height: 400 }), 1);
});

test('an empty board is not scaled', () => assert.equal(fitScale({ width: 0, height: 0 }, { width: 800, height: 600 }), 1));

test('the first measurement sets the scale', () => assert.equal(nextScale(null, 0.8, false), 0.8));

test('a smaller step keeps the scale, so the board does not bounce', () => assert.equal(nextScale(0.6, 0.9, false), 0.6));

test('a bigger step shrinks the scale', () => assert.equal(nextScale(0.6, 0.5, false), 0.5));

test('a resized window recomputes the scale from scratch', () => assert.equal(nextScale(0.6, 0.9, true), 0.9));
