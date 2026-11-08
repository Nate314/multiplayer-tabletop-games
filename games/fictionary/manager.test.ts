import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys, stepsOf } from '../../server/testing.ts';
import { fictionary } from './index.ts';
import type { GameState } from './types.ts';
import type { Result } from '../../shared/types.ts';

const ROOM = 'fictionary/g1';
const first = () => 0;
const FAKES = ['a small bird', 'a kind of pastry', 'a river boat'];

function table(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clock = { now: 1_000_000 };
  const manager = rememberingKeys(createGameManager([fictionary], first, undefined, { now: () => clock.now }));
  for (const name of ['A', 'B', 'C']) manager.join('fictionary', 'g1', name);
  agreeAll(manager, ROOM);
  const raw = () => manager.rawState(ROOM) as unknown as GameState;
  // Moves the test's clock and the mocked timers together
  const advance = (ms: number) => { clock.now += ms; t.mock.timers.tick(ms); };
  return { manager, raw, advance };
}

function ok(result: Result<unknown>): void {
  if ('error' in result) assert.fail(result.error);
}

// Every seat writes its fake, then votes for the real definition
function playWord(manager: ReturnType<typeof table>['manager'], raw: () => GameState, check = () => {}): void {
  FAKES.forEach((text, i) => { check(); ok(manager.action(ROOM, i + 1, { type: 'write', text })); });
  const real = raw().choices.findIndex(choice => choice.real);
  for (const seat of [1, 2, 3]) { check(); ok(manager.action(ROOM, seat, { type: 'vote', choice: real })); }
}

test('a word plays through writing, voting, reveal and Continue', (t: TestContext) => {
  const { manager, raw, advance } = table(t);
  assert.equal(raw().phase, 'writing');
  assert.equal(raw().round, 1);
  playWord(manager, raw);
  assert.equal(raw().phase, 'reveal');
  assert.deepEqual(raw().scores, { 1: 2, 2: 2, 3: 2 });
  for (const seat of [1, 2, 3]) ok(manager.action(ROOM, seat, { type: 'continue' }));
  advance(0);
  assert.equal(raw().phase, 'writing');
  assert.equal(raw().round, 2);
});

test('the writing deadline closes writing on the server clock', (t: TestContext) => {
  const { manager, raw, advance } = table(t);
  ok(manager.action(ROOM, 1, { type: 'write', text: FAKES[0] }));
  advance(119_999);
  assert.equal(raw().phase, 'writing');
  advance(1);
  assert.equal(raw().phase, 'voting');
  assert.deepEqual(raw().lastMove, { type: 'closeWriting', reason: 'timeUp' });
});

test('no history step shows the definition or an author before the reveal', (t: TestContext) => {
  const { manager, raw } = table(t);
  const { definition } = raw();
  const hidden = () => {
    // During voting the real definition is a bare choice text like every fake
    const shown = JSON.stringify(stepsOf(manager, 'fictionary')).replaceAll(`{"text":${JSON.stringify(definition)}}`, '');
    assert.equal(shown.includes(definition), false);
    assert.equal(shown.includes('"authors"'), false);
  };
  playWord(manager, raw, hidden);
  assert.ok(JSON.stringify(stepsOf(manager, 'fictionary')).includes(definition));
});

test('undo is never offered', (t: TestContext) => {
  const { manager } = table(t);
  ok(manager.action(ROOM, 1, { type: 'write', text: FAKES[0] }));
  assert.equal(manager.getState(ROOM, 1)?.undoAvailable, false);
  assert.ok('error' in manager.requestUndo(ROOM, 2));
});
