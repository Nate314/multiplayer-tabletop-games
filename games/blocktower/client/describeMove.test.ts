import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { PublicGameState } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
type Described = Pick<PublicGameState, 'lastMove' | 'playerNames'>;

const placed: Described = {
  playerNames,
  // Pulled from the middle of level 5 (0-based), whose center sits at 1.5 * 5.5
  lastMove: { type: 'place', seat: 1, block: 16, level: 18, from: { p: [0, 8.25, 0], q: [0, 0, 0, 1] }, to: { p: [0, 27.76, 0], q: [0, 0, 0, 1] } }
};
const fallen: Described = { playerNames, lastMove: { type: 'topple', seat: 1 } };

test('a placement names the player and the level the block came from', () => {
  assert.equal(describeMove(placed), 'Alice pulled a block from level 6 and placed it on top');
});

test('a free drop says dropped it on top', () => {
  const lastMove = { ...placed.lastMove!, free: true } as Described['lastMove'];
  assert.equal(describeMove({ playerNames, lastMove }), 'Alice pulled a block from level 6 and dropped it on top');
});

test('a topple names the player', () => {
  assert.equal(describeMove(fallen), 'Alice toppled the tower');
});

test('the starting tower has no move', () => {
  assert.equal(describeMove({ playerNames, lastMove: null }), '');
});
