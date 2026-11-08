import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys, stepsOf } from '../../server/testing.ts';
import { seeded } from '../testStates.ts';
import { PARTS } from './board.ts';
import { steadyhand } from './index.ts';
import { SOLO_BONUS } from './options.ts';
import type { GameState, PublicGameState, Seat } from './types.ts';
import type { Result } from '../../shared/types.ts';

const ROOM = 'steadyhand/g1';

function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function table(names: string[]) {
  const manager = rememberingKeys(createGameManager([steadyhand], seeded(42)));
  for (const name of names) manager.join('steadyhand', 'g1', name);
  agreeAll(manager, ROOM);
  const raw = () => manager.rawState(ROOM) as unknown as GameState;
  const act = (seat: Seat, action: object) => ok(manager.action(ROOM, seat, action));
  const move = (seat: Seat, m: object) => ok(manager.move(ROOM, seat, m));
  return { manager, raw, act, move };
}

test('drags are never History steps; out and buzz are', () => {
  const { manager, act, move } = table(['Alice', 'Bob']);
  act(1, { type: 'pick', part: 0 });
  for (let i = 0; i < 30; i++) act(1, { type: 'drag', at: [50 + i, 200] });
  move(1, { type: 'out', part: 0 });
  const steps = stepsOf(manager, 'steadyhand')!;
  assert.equal(steps.length, 2);
  // The start step is the first move's before snapshot, which still holds the last streamed position (the platform's cost, see constraints)
  assert.deepEqual((steps[0] as unknown as PublicGameState).live, { seat: 1, part: 0, at: [79, 200] });
  assert.ok(steps.slice(1).every(step => (step as unknown as PublicGameState).live === null));
});

test('an approved undo after a buzz leaves no part held', () => {
  const { manager, raw, act, move } = table(['Alice', 'Bob', 'Cat']);
  act(1, { type: 'pick', part: 0 });
  act(1, { type: 'drag', at: [60, 200] });
  move(1, { type: 'buzz', part: 0, at: [60, 200] });
  assert.equal(raw().buzzes[1], 1);
  ok(manager.requestUndo(ROOM, 2));
  ok(manager.voteUndo(ROOM, 1, true));
  const undone = ok(manager.voteUndo(ROOM, 3, true));
  assert.equal(undone.live, null);
  assert.equal(undone.currentPlayer, 1);
  assert.equal(raw().buzzes[1] ?? 0, 0);
});

test('one player plays solo and the game ends with the bonus', () => {
  const { raw, act, move } = table(['Alice']);
  for (const part of PARTS) {
    act(1, { type: 'pick', part: part.id });
    move(1, { type: 'out', part: part.id });
  }
  const state = raw();
  const total = PARTS.reduce((sum, p) => sum + p.value, 0);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.scores[1], total + 3 * SOLO_BONUS);
});
