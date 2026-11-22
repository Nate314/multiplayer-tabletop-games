import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys, stepsOf } from '../../server/testing.ts';
import type { HouseRuleValues } from '../../shared/houseRules.ts';
import type { Result } from '../../shared/types.ts';
import { seeded } from '../testStates.ts';
import { cribbage } from './index.ts';
import { playable } from './scoring.ts';
import { deadline, MUGGINS_MS, waitingOn } from './show.ts';
import type { GameState } from './types.ts';

const ROOM = 'cribbage/g1';

function ok(result: Result<unknown>): void {
  if ('error' in result) assert.fail(result.error);
}

function table(t: TestContext, values: HouseRuleValues) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clock = { now: 1_000_000 };
  const manager = rememberingKeys(createGameManager([cribbage], seeded(5), undefined, { now: () => clock.now }));
  for (const name of ['Alice', 'Bob']) manager.join('cribbage', 'g1', name);
  ok(manager.setHouseRules(ROOM, 1, { values, maxPlayers: null }));
  agreeAll(manager, ROOM);
  const raw = () => manager.rawState(ROOM) as unknown as GameState;
  return { manager, raw, clock };
}

// Plays the next step: every count is claimed exactly and every window passed. True when the step is recorded.
function step(manager: ReturnType<typeof table>['manager'], state: GameState): boolean {
  const waiting = waitingOn(state)[0];
  const seat = state.currentPlayer ?? waiting;
  switch (state.phase) {
    case 'discard':
      ok(manager.move(ROOM, seat, { type: 'discard', cards: state.hands[seat].slice(4) }));
      return true;
    case 'cut':
      ok(manager.move(ROOM, seat, { type: 'cut' }));
      return true;
    case 'pegging': {
      const card = playable(state.hands[seat], state.count)[0];
      ok(manager.move(ROOM, seat, card ? { type: 'play', card } : { type: 'go' }));
      return true;
    }
    case 'show':
      if (state.currentPlayer !== null) ok(manager.move(ROOM, seat, { type: 'claim', points: state.shows[state.showIndex].total }));
      else ok(manager.action(ROOM, seat, { type: 'noMuggins' }));
      return true;
    case 'roundOver':
      ok(manager.action(ROOM, seat, { type: 'acknowledgeRound' }));
      return false;
  }
}

function playToTheEnd(t: TestContext, values: HouseRuleValues) {
  const game = table(t, values);
  let recorded = 0;
  for (let steps = 0; !game.raw().isGameOver && steps < 5000; steps++) if (step(game.manager, game.raw())) recorded++;
  return { ...game, recorded };
}

test('a 61-point two-player game plays to the end', (t: TestContext) => {
  const { raw } = playToTheEnd(t, { targetScore: 61 });
  const state = raw();
  assert.equal(state.isGameOver, true);
  assert.equal(state.winners.length, 1);
  assert.ok(state.scores[state.winners[0]] >= 61);
  assert.ok(state.handNumber > 1);
});

test('every recorded step is one move or muggins action', (t: TestContext) => {
  const { manager, recorded } = playToTheEnd(t, { targetScore: 61, muggins: true });
  const moves = (stepsOf(manager, 'cribbage') ?? []).filter(s => s.historyStep !== 'start');
  assert.equal(moves.length, recorded);
});

test('an undo across a muggins window restarts its clock', (t: TestContext) => {
  const { manager, raw, clock } = table(t, { muggins: true });
  while (!(raw().phase === 'show' && raw().currentPlayer === null)) step(manager, raw());
  const opened = deadline(raw());
  assert.equal(opened, clock.now + MUGGINS_MS);
  clock.now += 5000;
  step(manager, raw()); // No Muggins closes the window
  assert.equal(deadline(raw()), null);
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  assert.equal(deadline(raw()), clock.now + MUGGINS_MS);
});

test("a play, go or cut sent by a seat whose turn it isn't is refused by the platform", (t: TestContext) => {
  const { manager, raw } = table(t, {});
  while (raw().phase === 'discard') step(manager, raw());
  const other = (seat: number | null) => (seat === 1 ? 2 : 1);
  assert.deepEqual(manager.move(ROOM, other(raw().currentPlayer), { type: 'cut' }), { error: 'Not your turn' });
  step(manager, raw());
  const state = raw();
  const card = state.hands[other(state.currentPlayer)][0];
  assert.deepEqual(manager.move(ROOM, other(state.currentPlayer), { type: 'play', card }), { error: 'Not your turn' });
  assert.deepEqual(manager.move(ROOM, other(state.currentPlayer), { type: 'go' }), { error: 'Not your turn' });
});
