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

// Dismisses `seat` 10 s into the drawing, with seat 1 or 2 left to approve
function dismiss(manager: ReturnType<typeof table>['manager'], advance: (ms: number) => void, seat: number): void {
  advance(10_000);
  manager.disconnect(ROOM, seat);
  ok(manager.requestDismiss(ROOM, seat === 1 ? 2 : 1, seat));
  ok(manager.voteDismiss(ROOM, seat === 3 ? 2 : 3, true));
}

test('dismissing the last guesser who had not guessed ends the turn at once, with the full reveal pause', (t: TestContext) => {
  const { manager, raw, advance } = table(t);
  ok(manager.action(ROOM, 2, { type: 'chat', text: raw().word ?? '' }));
  dismiss(manager, advance, 3);
  advance(0);
  assert.equal(raw().phase, 'reveal');
  assert.deepEqual(raw().lastMove, { type: 'reveal', word: raw().word, reason: 'allGuessed' });
  advance(4_999);
  assert.equal(raw().phase, 'reveal');
  advance(1);
  assert.equal(raw().phase, 'choosing');
});

test('a dismiss vote on the drawer settled by a voter disconnecting keeps the full reveal pause', (t: TestContext) => {
  const { manager, raw, advance } = table(t);
  advance(10_000);
  manager.disconnect(ROOM, 1);
  ok(manager.requestDismiss(ROOM, 2, 1));
  manager.disconnect(ROOM, 3);
  assert.deepEqual(raw().lastMove, { type: 'reveal', word: raw().word, reason: 'drawerLeft' });
  assert.equal(raw().phaseStartedAt, 1_010_000);
  advance(4_999);
  assert.equal(raw().phase, 'reveal');
  advance(1);
  assert.equal(raw().phase, 'choosing');
});

test('dismissing the drawer reveals the word, with the full reveal pause', (t: TestContext) => {
  const { manager, raw, advance } = table(t);
  dismiss(manager, advance, 1);
  assert.deepEqual(raw().lastMove, { type: 'reveal', word: raw().word, reason: 'drawerLeft' });
  advance(4_999);
  assert.equal(raw().phase, 'reveal');
  advance(1);
  assert.equal(raw().phase, 'choosing');
  assert.equal(raw().drawer, 2);
});

test('the history the server shows never carries the word or a guessed-only line during a drawing turn', (t: TestContext) => {
  const { manager, raw } = table(t);
  const word = raw().word ?? '';
  ok(manager.action(ROOM, 2, { type: 'chat', text: word }));
  ok(manager.action(ROOM, 2, { type: 'chat', text: 'secret banter' }));
  assert.equal(raw().chat.some(line => line.text === 'secret banter'), true);
  const shown = JSON.stringify(manager.history('pictionary', 'g1'));
  assert.equal(shown.includes('secret banter'), false);
  assert.equal(shown.includes(word), false);
});
