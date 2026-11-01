import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const pieces = (placed: number, total: number) =>
  Array.from({ length: total }, (_, i) => ({ x: 0, y: 0, placed: i < placed, heldBy: null, placedBy: null }));
const state = (placed: number, lastMove: unknown, isGameOver = false) => ({
  playerNames: { 1: 'Alice', 2: 'Bob' }, isGameOver, lastMove,
  board: { pieces: pieces(placed, 48) }, boards: {}, progress: {}
}) as never;

test('a snap', () => {
  assert.equal(describeMove(state(12, { type: 'snap', playerNumber: 1, piece: 3 })), 'Alice placed a piece (12 of 48)');
});
test('an unsnap', () => {
  assert.equal(describeMove(state(11, { type: 'unsnap', playerNumber: 2, piece: 3 })), 'Bob took back a piece');
});
test('the step that ended the game', () => {
  assert.equal(describeMove(state(48, { type: 'snap', playerNumber: 1, piece: 3 }, true)), 'Alice placed the last piece');
});
test('a snap by another racer with no board of theirs in the view', () => {
  const raceState = { ...(state(0, { type: 'snap', playerNumber: 1, piece: null }) as object), houseRules: { values: { mode: 'race' } } } as never;
  assert.equal(describeMove(raceState), 'Alice placed a piece');
});
test('no move', () => {
  assert.equal(describeMove(state(0, null)), '');
});
