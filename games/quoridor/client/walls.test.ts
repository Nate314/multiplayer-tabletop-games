import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextWallAction, squareMove, wallSlots } from './walls.ts';
import { createGameState } from '../rules.ts';
import type { PlacedWall, Position } from '../types.ts';

const at = (row: number, col: number): Position => ({ row, col });

test('a tap picks up a horizontal wall, and tapping it again turns it', () => {
  assert.equal(nextWallAction('move', 'tap'), 'wall-h');
  assert.equal(nextWallAction('wall-h', 'tap'), 'wall-v');
  assert.equal(nextWallAction('wall-v', 'tap'), 'wall-h');
});

test('rotate turns the held wall, or picks up a vertical one', () => {
  assert.equal(nextWallAction('wall-h', 'rotate'), 'wall-v');
  assert.equal(nextWallAction('move', 'rotate'), 'wall-v');
});

test('wall slots leave out overlapping and crossing places, and are empty with no walls left or no wall held', () => {
  const walls: PlacedWall[] = [{ row: 0, col: 0, orientation: 'horizontal', playerNumber: 2 }];
  const state = { ...createGameState('t'), activePlayers: [1, 2], pawns: { 1: at(8, 4), 2: at(0, 4) }, wallCounts: { 1: 10, 2: 10 }, walls };
  const horizontal = wallSlots(state, 1, 'wall-h');
  assert.equal(horizontal.includes('0-0') || horizontal.includes('0-1'), false);
  assert.equal(horizontal.includes('4-4'), true);
  assert.equal(wallSlots(state, 1, 'wall-v').includes('0-0'), false);
  assert.deepEqual(wallSlots({ ...state, wallCounts: { 1: 0, 2: 10 } }, 1, 'wall-h'), []);
  assert.deepEqual(wallSlots(state, 1, 'move'), []);
});

test('a click or drop on a square makes a pawn move or a wall with the selected action, or nothing', () => {
  const state = { ...createGameState('t'), activePlayers: [1, 2], pawns: { 1: at(8, 4), 2: at(0, 4) }, wallCounts: { 1: 10, 2: 10 } };
  assert.deepEqual(squareMove(state, 1, 'move', at(7, 4)), { type: 'move', row: 7, col: 4 });
  assert.equal(squareMove(state, 1, 'move', at(6, 4)), null);
  assert.deepEqual(squareMove(state, 1, 'wall-v', at(3, 3)), { type: 'wall', row: 3, col: 3, orientation: 'vertical' });
  assert.equal(squareMove(state, 1, 'wall-h', at(3, 8)), null); // off the board's edge
});
