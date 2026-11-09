import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { Cell } from '../geometry.ts';

const playerNames = { 1: 'Alice', 2: 'Bob', 3: 'Cara' };
const cells = (n: number): Cell[] => Array.from({ length: n }, (_, i): Cell => [i, 0, 0]);

test('describes a placement', () => {
  const lastMove = { type: 'place' as const, playerNumber: 1, color: 0 as const, piece: 12, cells: cells(5) };
  const owners = { 0: 1, 1: 2, 2: 1, 3: 2 } as const;
  assert.equal(describeMove({ lastMove, playerNames, owners, board: 'squares' }), 'Alice placed a piece of 5 squares in Blue');
});

test('describes a placement in the shared color', () => {
  const lastMove = { type: 'place' as const, playerNumber: 3, color: 3 as const, piece: 4, cells: cells(3) };
  const owners = { 0: 1, 1: 2, 2: 3, 3: 'shared' } as const;
  assert.equal(describeMove({ lastMove, playerNames, owners, board: 'triangles' }), 'Cara placed a piece of 3 triangles in Green (shared)');
});

test('describes nothing before the first move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames, owners: { 0: 1, 1: 2, 2: 1, 3: 2 }, board: 'squares' }), '');
});
