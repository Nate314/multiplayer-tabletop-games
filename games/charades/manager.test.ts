import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys, stepsOf } from '../../server/testing.ts';
import { charades } from './index.ts';
import type { GameState } from './types.ts';
import type { Result } from '../../shared/types.ts';

const ROOM = 'charades/g1';
const first = () => 0;

function table(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clock = { now: 1_000_000 };
  const manager = rememberingKeys(createGameManager([charades], first, undefined, { now: () => clock.now }));
  for (const name of ['A', 'B', 'C']) manager.join('charades', 'g1', name);
  agreeAll(manager, ROOM);
  ok(manager.move(ROOM, 1, { type: 'choose', index: 0 }));
  const raw = () => manager.rawState(ROOM) as unknown as GameState;
  // Moves the test's clock and the mocked timers together
  const advance = (ms: number) => { clock.now += ms; t.mock.timers.tick(ms); };
  return { manager, raw, advance };
}

function ok(result: Result<unknown>): void {
  if ('error' in result) assert.fail(result.error);
}

test('the turn times out on the server clock', (t: TestContext) => {
  const { raw, advance } = table(t);
  advance(89_999);
  assert.equal(raw().phase, 'drawing');
  advance(1);
  assert.equal(raw().phase, 'reveal');
});

test('no history step carries the prompt during acting', (t: TestContext) => {
  const { manager, raw } = table(t);
  const prompt = raw().word ?? '';
  assert.ok(prompt.length > 0);
  ok(manager.action(ROOM, 1, { type: 'chat', text: prompt }));
  assert.equal(JSON.stringify(stepsOf(manager, 'charades')).includes(prompt), false);
});
