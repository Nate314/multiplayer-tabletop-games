import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys, stepsOf } from '../../server/testing.ts';
import { categories } from './index.ts';
import type { GameState } from './types.ts';
import type { Result } from '../../shared/types.ts';

const ROOM = 'categories/g1';
const first = () => 0;

function ok(result: Result<unknown>): void {
  if ('error' in result) assert.fail(result.error);
}

function table(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clock = { now: 1_000_000 };
  const manager = rememberingKeys(createGameManager([categories], first, undefined, { now: () => clock.now }));
  for (const name of ['A', 'B', 'C']) manager.join('categories', 'g1', name);
  agreeAll(manager, ROOM);
  const raw = () => manager.rawState(ROOM) as unknown as GameState;
  const advance = (ms: number) => { clock.now += ms; t.mock.timers.tick(ms); };
  // One answer per category, each starting with the round's letter
  const answers = (seat: number) => raw().list.map((_, i) => `${raw().letter}${seat}${i}`);
  const done = (seat: number) => ok(manager.action(ROOM, seat, { type: 'done', answers: answers(seat) }));
  return { manager, raw, advance, answers, done };
}

test('a round plays through answering, a challenge and Continue', (t: TestContext) => {
  const { manager, raw, answers, done } = table(t);
  assert.equal(raw().phase, 'answering');
  for (const seat of [1, 2, 3]) done(seat);
  assert.equal(raw().phase, 'review');
  ok(manager.action(ROOM, 2, { type: 'challenge', category: 0, seat: 1 }));
  ok(manager.action(ROOM, 3, { type: 'judge', category: 0, seat: 1, reject: true }));
  assert.equal(raw().challenges[0].verdict, 'rejected');
  for (const seat of [1, 2, 3]) ok(manager.action(ROOM, seat, { type: 'continue' }));
  assert.equal(raw().round, 2);
  assert.equal(raw().phase, 'answering');
  assert.deepEqual(raw().scores, { 1: raw().list.length - 1, 2: raw().list.length, 3: raw().list.length });
  assert.equal(answers(1).length, raw().list.length);
});

test('the round deadline closes answering on the server clock', (t: TestContext) => {
  const { raw, advance } = table(t);
  advance(119_999);
  assert.equal(raw().phase, 'answering');
  advance(1);
  assert.equal(raw().phase, 'review');
  assert.deepEqual(raw().lastMove, { type: 'closeAnswers', reason: 'timeUp' });
});

test('no history step shows an answer before the review', (t: TestContext) => {
  const { manager, answers, done } = table(t);
  ok(manager.action(ROOM, 1, { type: 'answers', answers: answers(1) }));
  done(1);
  done(2);
  const steps = stepsOf(manager, 'categories') ?? [];
  assert.ok(steps.length > 0);
  assert.equal(JSON.stringify(steps).includes(answers(1)[0]), false);
  assert.equal(JSON.stringify(steps).includes(answers(2)[0]), false);
});

test('a second answers action is not a history step', (t: TestContext) => {
  const { manager, answers } = table(t);
  ok(manager.action(ROOM, 1, { type: 'answers', answers: answers(1) }));
  const before = stepsOf(manager, 'categories')?.length;
  ok(manager.action(ROOM, 1, { type: 'answers', answers: answers(1).map(a => `${a}x`) }));
  assert.equal(stepsOf(manager, 'categories')?.length, before);
});

test('undo is never offered', (t: TestContext) => {
  const { manager, done } = table(t);
  done(1);
  assert.equal(manager.getState(ROOM, 1)?.undoAvailable, false);
  assert.ok('error' in manager.requestUndo(ROOM, 2));
});
