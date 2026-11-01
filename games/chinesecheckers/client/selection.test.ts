import { test } from 'node:test';
import assert from 'node:assert/strict';
import { livePath, pathFor, pickHole } from './selection.ts';
import { createGameState } from '../rules.ts';
import { holeKey } from '../board.ts';
import type { Hole, PublicGameState, Seat } from '../types.ts';

const at = (q: number, r: number): Hole => ({ q, r });

function stateWith(marbles: [number, number, Seat][]): PublicGameState {
  return {
    ...createGameState('g1'),
    started: true,
    currentPlayer: 1,
    activePlayers: [1, 2],
    points: { 1: 0, 2: 3 },
    holes: Object.fromEntries(marbles.map(([q, r, seat]) => [holeKey({ q, r }), seat])),
    undoAvailable: false,
    moveCount: 0
  };
}

test('clicking an own marble starts a path and clicking it again clears it', () => {
  const state = stateWith([[0, 0, 1]]);
  assert.deepEqual(pickHole(state, 1, [], at(0, 0)), { path: [at(0, 0)], send: false });
  assert.deepEqual(pickHole(state, 1, [at(0, 0)], at(0, 0)), { path: [], send: false });
});

test('a step is sent at once', () => {
  const state = stateWith([[0, 0, 1]]);
  assert.deepEqual(pickHole(state, 1, [at(0, 0)], at(1, 0)), { path: [at(0, 0), at(1, 0)], send: true });
});

test('a hop with more hops beyond waits for End move', () => {
  const state = stateWith([[0, 0, 1], [1, 0, 2], [3, 0, 2]]);
  assert.deepEqual(pickHole(state, 1, [at(0, 0)], at(2, 0)), { path: [at(0, 0), at(2, 0)], send: false });
  // Clicking the marble part way through the chain starts over from it
  assert.deepEqual(pickHole(state, 1, [at(0, 0), at(2, 0)], at(0, 0)), { path: [at(0, 0)], send: false });
});

test('a hop with nothing beyond is sent at once', () => {
  const state = stateWith([[0, 0, 1], [1, 0, 2]]);
  assert.deepEqual(pickHole(state, 1, [at(0, 0)], at(2, 0)), { path: [at(0, 0), at(2, 0)], send: true });
});

test('an opponent marble or an unmarked hole changes nothing', () => {
  const state = stateWith([[0, 0, 1], [1, 0, 2]]);
  const path = [at(0, 0)];
  assert.deepEqual(pickHole(state, 1, path, at(1, 0)), { path, send: false });
  assert.deepEqual(pickHole(state, 1, path, at(3, -3)), { path, send: false });
  assert.deepEqual(pickHole(state, 1, [], at(1, 0)), { path: [], send: false });
});

test('a path the current state no longer allows is dropped', () => {
  const chain = [at(0, 0), at(2, 0)];
  const before = stateWith([[0, 0, 1], [1, 0, 2], [3, 0, 2]]);
  assert.deepEqual(livePath(before, 1, chain), chain);
  assert.deepEqual(livePath(before, 1, [at(0, 0)]), [at(0, 0)]);
  // The hopped marble's owner was dismissed, so it came off the board without a new move
  const after = stateWith([[0, 0, 1], [3, 0, 2]]);
  assert.deepEqual(livePath(after, 1, chain), []);
  // The picked marble itself is gone
  assert.deepEqual(livePath(stateWith([[1, 0, 2]]), 1, [at(0, 0)]), []);
  assert.deepEqual(livePath(after, 1, []), []);
});

test('a path from an earlier state is dropped', () => {
  const path = [at(0, 0), at(2, 0)];
  assert.deepEqual(pathFor({ moveCount: 3, path }, 4), []);
  assert.deepEqual(pathFor({ moveCount: 4, path }, 4), path);
});
