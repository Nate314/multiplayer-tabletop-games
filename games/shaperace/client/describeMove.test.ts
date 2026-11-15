import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

// Tray shape 1 is the five point star; the brief's "the star" predates the shape set, which has no plain Star
const state = (fields: object) => ({
  playerNames: { 1: 'Alice', 2: 'Bob' }, popped: false, finishTimes: {}, lastMove: null,
  layout: { size: 9, holes: [], tray: ['circle', 'star5'], startTurns: [] }, ...fields
}) as never;

test('a recorded place names the shape', () => {
  assert.equal(describeMove(state({ lastMove: { playerNumber: 1, shape: 1, hole: 4 } })), 'Alice placed the five point star');
});

test("another racer's placement mid-race has no shape", () => {
  assert.equal(describeMove(state({ lastMove: { playerNumber: 2 } })), 'Bob placed a shape');
});

test('the pop', () => {
  assert.equal(describeMove(state({ popped: true, lastMove: { playerNumber: 2, shape: 0, hole: 0 } })), 'Time ran out');
});

test('the placement that fills a board gives the time', () => {
  assert.equal(describeMove(state({ lastMove: { playerNumber: 1, shape: 0, hole: 0 }, finishTimes: { 1: 42_345 } })), 'Alice filled the board in 0:42.3');
});

test('no move', () => {
  assert.equal(describeMove(state({})), '');
});
