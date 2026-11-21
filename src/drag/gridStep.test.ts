import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridStep } from './gridStep.ts';

test('arrow keys step to the neighbour on a 3 by 3 grid', () => {
  assert.equal(gridStep(4, 'ArrowRight', 3, 9), 5);
  assert.equal(gridStep(4, 'ArrowLeft', 3, 9), 3);
  assert.equal(gridStep(4, 'ArrowUp', 3, 9), 1);
  assert.equal(gridStep(4, 'ArrowDown', 3, 9), 7);
});

test('an arrow key at an edge leaves the index unchanged', () => {
  assert.equal(gridStep(5, 'ArrowRight', 3, 9), 5);
  assert.equal(gridStep(3, 'ArrowLeft', 3, 9), 3);
  assert.equal(gridStep(1, 'ArrowUp', 3, 9), 1);
  assert.equal(gridStep(7, 'ArrowDown', 3, 9), 7);
});

test('moving down into a ragged last row stays put when the cell is missing', () => {
  assert.equal(gridStep(3, 'ArrowDown', 4, 6), 3);
});

test('a non-arrow key returns null', () => {
  assert.equal(gridStep(4, 'a', 3, 9), null);
});
