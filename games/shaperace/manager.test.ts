import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys } from '../../server/testing.ts';
import type { Result } from '../../shared/types.ts';
import { fits } from './board.ts';
import { shaperace } from './index.ts';
import type { GameState } from './types.ts';

const ROOM = 'shaperace/g1';

function ok(result: Result<unknown>): void {
  if ('error' in result) assert.fail(result.error);
}

test('the server clock ends a race', (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clock = { now: 1_000_000 };
  const manager = rememberingKeys(createGameManager([shaperace], () => 0, undefined, { now: () => clock.now }));
  for (const name of ['A', 'B']) manager.join('shaperace', 'g1', name);
  agreeAll(manager, ROOM);
  const raw = () => manager.rawState(ROOM) as unknown as GameState;
  const advance = (ms: number) => { clock.now += ms; t.mock.timers.tick(ms); };
  assert.equal(raw().raceStartedAt, clock.now);

  const layout = raw().layout!;
  const shape = layout.tray.indexOf(layout.holes[0]);
  while (!fits(layout, raw().boards[2]!.placed, shape, 0, raw().boards[2]!.turns[shape])) ok(manager.action(ROOM, 2, { type: 'turn', shape }));
  ok(manager.action(ROOM, 2, { type: 'place', shape, hole: 0 }));

  advance(59_999);
  assert.equal(raw().isGameOver, false);
  advance(1);
  assert.equal(raw().isGameOver, true);
  assert.equal(raw().popped, true);
  assert.deepEqual(raw().winners, [2]);
});
