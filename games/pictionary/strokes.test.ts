import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys, withRules } from '../../server/testing.ts';
import { addPlayer, applyMove } from '../../shared/seating.ts';
import type { Result } from '../../shared/types.ts';
import { BRUSH_SIZES, CANVAS_H, CANVAS_W, MAX_POINTS, PALETTE } from './clock.ts';
import { pictionary } from './index.ts';
import { applyAction, createGameState, onDeadline } from './rules.ts';
import type { GameState } from './types.ts';

const NOW = 1_000_000;
const first = () => 0;

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function drawing(): GameState {
  let state: GameState = { ...createGameState('g'), houseRules: withRules({}) };
  for (const name of ['Alice', 'Bob', 'Cara']) state = ok(addPlayer(pictionary, state, name, first));
  return ok(applyMove(pictionary, { ...state, wordChoices: ['castle', 'apple', 'tree'] }, 1, { type: 'choose', index: 0 }, first, NOW));
}

const act = (state: GameState, seat: number, action: unknown) => applyAction(state, seat, action, first, NOW);
const line = (points: unknown[], extra = {}) => ({ type: 'stroke', tool: 'pen', color: 0, size: 1, points, ...extra });

test('the drawer draws, extends, fills, undoes and clears', () => {
  let state = ok(act(drawing(), 1, line([1, 2, 3, 4])));
  assert.deepEqual(state.strokes, [{ id: 1, kind: 'line', tool: 'pen', color: 0, size: 1, points: [1, 2, 3, 4] }]);
  state = ok(act(state, 1, { type: 'extend', id: 1, points: [5, 6] }));
  assert.deepEqual(state.strokes[0].kind === 'line' && state.strokes[0].points, [1, 2, 3, 4, 5, 6]);
  state = ok(act(state, 1, { type: 'fill', color: 2, x: 10, y: 20 }));
  assert.deepEqual(state.strokes[1], { id: 2, kind: 'fill', color: 2, x: 10, y: 20 });
  assert.equal(state.nextStrokeId, 3);
  state = ok(act(state, 1, { type: 'undoStroke' }));
  assert.equal(state.strokes.length, 1);
  state = ok(act(state, 1, { type: 'clear' }));
  assert.deepEqual(state.strokes, []);
  assert.equal(BRUSH_SIZES.length, 3);
});

test('a guesser cannot draw', () => {
  const state = drawing();
  for (const action of [line([1, 2]), { type: 'extend', id: 1, points: [1, 2] }, { type: 'fill', color: 0, x: 1, y: 1 }, { type: 'undoStroke' }, { type: 'clear' }]) {
    assert.deepEqual(act(state, 2, action), { error: 'Only the drawer can draw' });
  }
  const choosing = { ...state, phase: 'choosing' as const };
  assert.deepEqual(act(choosing, 1, line([1, 2])), { error: 'Only the drawer can draw' });
});

test('extend only grows the last stroke', () => {
  let state = ok(act(drawing(), 1, line([1, 2])));
  state = ok(act(state, 1, line([3, 4])));
  assert.ok('error' in act(state, 1, { type: 'extend', id: 1, points: [5, 6] }));
  assert.ok('error' in act(state, 1, { type: 'extend', id: 9, points: [5, 6] }));
  state = ok(act(state, 1, { type: 'fill', color: 0, x: 1, y: 1 }));
  assert.ok('error' in act(state, 1, { type: 'extend', id: 2, points: [5, 6] }));
  assert.ok('error' in act(drawing(), 1, { type: 'extend', id: 1, points: [5, 6] }));
});

test('points outside the canvas, odd-length or non-integer points are refused', () => {
  const state = drawing();
  const bad = [[1], [1.5, 2], [-1, 0], [CANVAS_W + 1, 0], [0, CANVAS_H + 1], [], ['1', 2], [NaN, 1], Array(202).fill(1)];
  for (const points of bad) {
    assert.ok('error' in act(state, 1, line(points)), JSON.stringify(points).slice(0, 30));
  }
  ok(act(state, 1, line([0, 0, CANVAS_W, CANVAS_H])));
  ok(act(state, 1, line(Array(200).fill(1))));
  assert.ok('error' in act(state, 1, { type: 'fill', color: 0, x: CANVAS_W + 1, y: 0 }));
  assert.ok('error' in act(state, 1, { type: 'fill', color: 0, x: 0.5, y: 0 }));
  for (const color of [-1, PALETTE.length, 1.5, '0']) assert.ok('error' in act(state, 1, line([1, 2], { color })));
  for (const extra of [{ size: 3 }, { tool: 'brush' }]) assert.ok('error' in act(state, 1, line([1, 2], extra)));
  assert.ok('error' in act(state, 1, { type: 'fill', color: PALETTE.length, x: 0, y: 0 }));
});

test('the drawing stops at MAX_POINTS', () => {
  let state = drawing();
  for (let i = 0; i < MAX_POINTS / 200; i++) state = ok(act(state, 1, line(Array(200).fill(7))));
  assert.deepEqual(act(state, 1, line([1, 2])), { error: 'The drawing is full; undo or clear to keep drawing' });
  assert.ok('error' in act(state, 1, { type: 'extend', id: state.nextStrokeId - 1, points: [1, 2] }));
  assert.ok('error' in act(state, 1, { type: 'fill', color: 0, x: 1, y: 1 }));
  ok(act(ok(act(state, 1, { type: 'undoStroke' })), 1, line([1, 2])));
});

test('a new turn starts with a blank canvas', () => {
  const state = ok(act(drawing(), 1, line([1, 2])));
  const reveal = onDeadline(state, NOW + 1, first);
  assert.equal(reveal.strokes.length, 1);
  const next = onDeadline(reveal, NOW + 2, first);
  assert.equal(next.phase, 'choosing');
  assert.deepEqual(next.strokes, []);
  const again = ok(applyMove(pictionary, next, 2, { type: 'choose', index: 0 }, first, NOW));
  assert.deepEqual(again.strokes, []);
});

test('strokes are not moves', (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const manager = rememberingKeys(createGameManager([pictionary], first, undefined, { now: () => 1_000_000 }));
  for (const name of ['A', 'B', 'C']) manager.join('pictionary', 'g1', name);
  agreeAll(manager, 'pictionary/g1');
  assert.ok(!('error' in manager.move('pictionary/g1', 1, { type: 'choose', index: 0 })));
  const moves = () => manager.getState('pictionary/g1', 1)?.moveCount;
  const before = moves();
  for (let i = 0; i < 10; i++) assert.ok(!('error' in manager.action('pictionary/g1', 1, line([i, i]))));
  assert.equal(moves(), before);
  assert.equal((manager.rawState('pictionary/g1') as unknown as GameState).strokes.length, 10);
});
