import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownsTurn, turnEndViews, turnStartView } from './camera.ts';
import { DEFAULT_ORBIT } from './orbit.ts';
import { IDENTITY, QUARTER_TURN, startingTower } from '../physics.ts';
import type { PublicGameState } from '../types.ts';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test('the first turn starts from the default view, measured against the turntable', () => {
  assert.deepEqual(turnStartView({}, 1, IDENTITY), DEFAULT_ORBIT);
  const turned = turnStartView({}, 1, QUARTER_TURN);
  assert.ok(near(turned.yaw, DEFAULT_ORBIT.yaw + Math.PI / 2));
  assert.equal(turned.pitch, DEFAULT_ORBIT.pitch);
  assert.equal(turned.distance, DEFAULT_ORBIT.distance);
});

test('a saved view comes back on the same side of the tower after the turntable turned', () => {
  const saved = turnEndViews({}, 1, { yaw: 1, pitch: 0.5, distance: 40 }, IDENTITY);
  const back = turnStartView(saved, 1, QUARTER_TURN);
  assert.ok(near(back.yaw, 1 + Math.PI / 2));
  assert.equal(back.pitch, 0.5);
  assert.equal(back.distance, 40);
});

test('each seat on a shared device keeps its own view', () => {
  let saved = turnEndViews({}, 1, { yaw: 1, pitch: 0.5, distance: 40 }, IDENTITY);
  saved = turnEndViews(saved, 2, { yaw: -2, pitch: 0.3, distance: 70 }, IDENTITY);
  assert.deepEqual(turnStartView(saved, 1, IDENTITY), { yaw: 1, pitch: 0.5, distance: 40 });
  assert.deepEqual(turnStartView(saved, 2, IDENTITY), { yaw: -2, pitch: 0.3, distance: 70 });
  assert.deepEqual(turnStartView(saved, 3, IDENTITY), DEFAULT_ORBIT);
});

test('a vote does not change who owns the turn', () => {
  const state = {
    blocks: startingTower(), currentPlayer: 1, activePlayers: [1, 2], isGameOver: false, toppled: false,
    undoVote: { requestedBy: 2, votes: {} }, dismissVote: null
  } as unknown as PublicGameState;
  assert.equal(ownsTurn(state, 1), true);
  assert.equal(ownsTurn(state, 2), false);
  assert.equal(ownsTurn(state, null), false);
  assert.equal(ownsTurn({ ...state, toppled: true }, 1), false);
  assert.equal(ownsTurn({ ...state, isGameOver: true }, 1), false);
  assert.equal(ownsTurn({ ...state, activePlayers: [1] }, 1), false);
});
