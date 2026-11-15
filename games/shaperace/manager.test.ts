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

function table(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clock = { now: 1_000_000 };
  const manager = rememberingKeys(createGameManager([shaperace], () => 0, undefined, { now: () => clock.now }));
  for (const name of ['A', 'B']) manager.join('shaperace', 'g1', name);
  agreeAll(manager, ROOM);
  const raw = () => manager.rawState(ROOM) as unknown as GameState;
  const advance = (ms: number) => { clock.now += ms; t.mock.timers.tick(ms); };
  // Turns the shape that belongs in `hole` until it fits, then places it
  const place = (seat: number, hole: number) => {
    const layout = raw().layout!;
    const shape = layout.tray.indexOf(layout.holes[hole]);
    while (!fits(layout, raw().boards[seat]!.placed, shape, hole, raw().boards[seat]!.turns[shape])) ok(manager.action(ROOM, seat, { type: 'turn', shape }));
    ok(manager.action(ROOM, seat, { type: 'place', shape, hole }));
  };
  return { manager, raw, advance, clock, place };
}

test('the server clock ends a race', (t: TestContext) => {
  const { raw, advance, clock, place } = table(t);
  assert.equal(raw().raceStartedAt, clock.now);
  place(2, 0);

  advance(59_999);
  assert.equal(raw().isGameOver, false);
  advance(1);
  assert.equal(raw().isGameOver, true);
  assert.equal(raw().popped, true);
  assert.deepEqual(raw().winners, [2]);
});

test('a pause keeps the remaining race time', (t: TestContext) => {
  const { manager, raw, advance, clock, place } = table(t);
  advance(20_000);
  ok(manager.requestPause(ROOM, 1));
  ok(manager.votePause(ROOM, 2, true));
  assert.equal(raw().paused, true);
  advance(30_000);
  assert.equal(raw().isGameOver, false);
  ok(manager.resumeGame(ROOM, 1));
  assert.equal(shaperace.deadline!(raw()), clock.now + 40_000);
  assert.equal(raw().pausedAt, undefined);
  advance(5_000);
  for (let hole = 0; hole < raw().layout!.size; hole++) place(2, hole);
  assert.equal(raw().finishTimes[2], 25_000);
  advance(34_999);
  assert.equal(raw().isGameOver, false);
  advance(1);
  assert.equal(raw().isGameOver, true);
});
