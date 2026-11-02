import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CELL_NAMES, LINES, emptyCells, findLine, isCellIndex, isFull } from './lines.ts';
import type { Cells } from './lines.ts';

test('there are eight lines', () => {
  assert.equal(LINES.length, 8);
  assert.deepEqual(LINES, LINES.map(line => [...line]));
  assert.ok(LINES.some(line => line.join() === '0,4,8'));
  assert.ok(LINES.some(line => line.join() === '2,4,6'));
});

test('findLine finds a row, a column and both diagonals for either seat', () => {
  const row: Cells = [1, 1, 1, null, null, null, null, null, null];
  assert.deepEqual(findLine(row), { seat: 1, line: [0, 1, 2] });

  const column: Cells = [null, 2, null, null, 2, null, null, 2, null];
  assert.deepEqual(findLine(column), { seat: 2, line: [1, 4, 7] });

  const diagonal: Cells = [1, null, null, null, 1, null, null, null, 1];
  assert.deepEqual(findLine(diagonal), { seat: 1, line: [0, 4, 8] });

  const antiDiagonal: Cells = [null, null, 2, null, 2, null, 2, null, null];
  assert.deepEqual(findLine(antiDiagonal), { seat: 2, line: [2, 4, 6] });
});

test('findLine ignores two in a row and mixed lines', () => {
  assert.equal(findLine([1, 1, null, null, null, null, null, null, null]), null);
  assert.equal(findLine([1, 2, 1, null, 2, null, null, null, null]), null);
  assert.equal(findLine(emptyCells()), null);
});

test('isFull is true only with no empty cell', () => {
  assert.equal(isFull(emptyCells()), false);
  assert.equal(isFull([1, 2, 1, 1, 2, 2, 2, 1, null]), false);
  assert.equal(isFull([1, 2, 1, 1, 2, 2, 2, 1, 1]), true);
});

test('isCellIndex accepts 0 to 8 integers only', () => {
  for (const value of [0, 4, 8]) assert.equal(isCellIndex(value), true);
  for (const value of ['4', 4.5, -1, 9, null]) assert.equal(isCellIndex(value), false);
});

test('CELL_NAMES[4] is center', () => {
  assert.equal(CELL_NAMES.length, 9);
  assert.equal(CELL_NAMES[4], 'center');
});
