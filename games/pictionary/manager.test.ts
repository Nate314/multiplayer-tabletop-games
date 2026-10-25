import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys } from '../../server/testing.ts';
import { pictionary } from './index.ts';
import type { GameState } from './types.ts';
import type { Result } from '../../shared/types.ts';

const ROOM = 'pictionary/g1';
const first = () => 0;

function table(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clock = { now: 1_000_000 };
  const manager = rememberingKeys(createGameManager([pictionary], first, undefined, { now: () => clock.now }));
  for (const name of ['A', 'B', 'C']) manager.join('pictionary', 'g1', name);
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

test('a correct guess is a move and a wrong one is not', (t: TestContext) => {
  const { manager, raw } = table(t);
  const moves = () => manager.getState(ROOM, 1)?.moveCount;
  assert.equal(moves(), 1);
  ok(manager.action(ROOM, 2, { type: 'chat', text: 'zzzz' }));
  assert.equal(moves(), 1);
  ok(manager.action(ROOM, 2, { type: 'chat', text: raw().word ?? '' }));
  assert.equal(moves(), 2);
  assert.deepEqual(raw().guessed, [2]);
});

test('the turn times out on the server clock', (t: TestContext) => {
  const { raw, advance } = table(t);
  advance(89_999);
  assert.equal(raw().phase, 'drawing');
  advance(1);
  assert.equal(raw().phase, 'reveal');
  assert.equal(raw().lastMove?.type, 'reveal');
});
