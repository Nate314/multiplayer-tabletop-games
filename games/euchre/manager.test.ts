import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys, stepsOf, fileOf } from '../../server/testing.ts';
import { canPlayCard } from './rules.ts';
import { euchre } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'euchre/g1';
const NAMES = ['A', 'B', 'C', 'D'];

function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gameWith(...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([euchre], seeded(1)));
  for (const name of names) manager.join('euchre', 'g1', name);
  agreeAll(manager, ROOM);
  return manager;
}

function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: number | null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

// A legal move from the current player's own view: the dealer's left orders up, never alone, the dealer discards
// their first card, then everyone plays their first legal card
function anyMove(view: PublicGameState, seat: number): Move {
  const { phase, hand, trick, trump } = view;
  if (phase === 'order') return { type: 'orderUp' };
  if (phase === 'alone') return { type: 'goAlone', alone: false };
  if (phase === 'discard') return { type: 'discard', card: hand[0] };
  if (phase === 'name') return { type: 'pass' };
  const card = hand.find(held => canPlayCard(hand, held, trick, trump)) ?? assert.fail(`seat ${seat} has nothing to play`);
  return { type: 'play', card };
}

function step(manager: Manager): PublicGameState {
  const state = viewOf(manager, null);
  if (state.roundSummary) {
    for (const seat of state.activePlayers) ok(manager.action(ROOM, seat, { type: 'acknowledgeRound' }));
    return viewOf(manager, null);
  }
  const seat = state.currentPlayer ?? assert.fail('nobody to move');
  return ok(manager.move(ROOM, seat, anyMove(viewOf(manager, seat), seat)));
}

test('moves wait for four players', () => {
  const manager = gameWith('A', 'B', 'C');
  assert.deepEqual(manager.move(ROOM, 1, { type: 'pass' }), { error: 'Waiting for more players' });
  assert.equal(viewOf(manager, 1).hand.length, 0);
  manager.join('euchre', 'g1', 'D');
  assert.equal(viewOf(manager, 1).hand.length, 5);
  assert.ok(viewOf(manager, null).upcard);
  assert.equal('error' in manager.join('euchre', 'g1', 'E'), true);
});

test('a short game: each player sees only their own hand, the table sees none', () => {
  const manager = gameWith(...NAMES);
  // Order up, stay with the partner, the discard and two tricks
  for (let i = 0; i < 3 + 8; i++) step(manager);
  const views = [1, 2, 3, 4].map(seat => viewOf(manager, seat));
  views.forEach((view, index) => assert.equal(view.hand.length, view.handCounts[index + 1]));
  assert.notDeepEqual(views[0].hand, views[1].hand);
  const dealer = views[0].dealer ?? assert.fail('no dealer');
  assert.ok(viewOf(manager, dealer).discard);

  const history = stepsOf(manager, 'euchre') as unknown as PublicGameState[];
  assert.equal(history.length, 12);
  for (const state of [...history, viewOf(manager, null)]) {
    assert.deepEqual(state.hand, []);
    assert.equal(state.discard, null);
    for (const key of ['hands', 'kitty']) assert.equal(key in state, false);
  }
});

test('a rejoin mid-turn shows the same half-finished trick and hand', () => {
  const manager = gameWith(...NAMES);
  for (let i = 0; i < 3 + 2; i++) step(manager);
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  const before = viewOf(manager, seat);
  assert.equal(before.trick.length, 2);
  manager.disconnect(ROOM, seat);
  assert.deepEqual(viewOf(manager, null).disconnected, [seat]);
  const back = manager.join('euchre', 'g1', NAMES[seat - 1], true);
  if ('error' in back) assert.fail(back.error);
  const after = back.state as PublicGameState;
  assert.deepEqual(after.hand, before.hand);
  assert.deepEqual(after.trick, before.trick);
  assert.equal(after.currentPlayer, seat);
  ok(manager.move(ROOM, seat, anyMove(after, seat)));
});

test('undo restores making trump', () => {
  const manager = gameWith(...NAMES);
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  ok(manager.move(ROOM, seat, { type: 'pass' }));
  ok(manager.requestUndo(ROOM, seat));
  for (const other of [1, 2, 3, 4].filter(s => s !== seat)) manager.voteUndo(ROOM, other, true);
  const restored = viewOf(manager, null);
  assert.equal(restored.currentPlayer, seat);
  assert.deepEqual(restored.passed, []);
});

test('a whole game played with legal moves ends when a team reaches 10', () => {
  const manager = gameWith(...NAMES);
  let state = viewOf(manager, null);
  for (let moves = 0; !state.isGameOver && moves < 20000; moves++) state = step(manager);
  assert.equal(state.isGameOver, true);
  assert.equal(state.winners.length, 2);
  assert.ok(Math.max(...state.scores) >= 10);
  assert.ok(state.handNumber > 1);
  const file = fileOf(manager, 'euchre', new Date());
  assert.ok(file && 'file' in file);
});

test('dismissing a player mid-game ends it and their opponents win', () => {
  const manager = gameWith(...NAMES);
  step(manager);
  manager.disconnect(ROOM, 2);
  ok(manager.requestDismiss(ROOM, 1, 2));
  ok(manager.voteDismiss(ROOM, 3, true));
  const state = ok(manager.voteDismiss(ROOM, 4, true));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1, 3]);
});
