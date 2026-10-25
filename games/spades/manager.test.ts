import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys } from '../../server/testing.ts';
import { canPlayCard, LOSING_SCORE, targetScore } from './rules.ts';
import { spades } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'spades/g1';
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
  const manager = rememberingKeys(createGameManager([spades], seeded(1)));
  for (const name of names) manager.join('spades', 'g1', name);
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

// A legal move from the current player's own view: everyone bids 3, seat 2 bids nil, then plays their first legal card
function anyMove(view: PublicGameState, seat: number): Move {
  const { phase, hand, trick, spadesBroken } = view;
  if (phase === 'bidding') return { type: 'bid', tricks: seat === 2 ? 0 : 3 };
  const card = hand.find(held => canPlayCard(hand, held, trick, spadesBroken)) ?? assert.fail(`seat ${seat} has nothing to play`);
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
  assert.deepEqual(manager.move(ROOM, 1, { type: 'bid', tricks: 3 }), { error: 'Waiting for more players' });
  assert.equal(viewOf(manager, 1).hand.length, 0);
  manager.join('spades', 'g1', 'D');
  assert.equal(viewOf(manager, 1).hand.length, 13);
  assert.equal('error' in manager.join('spades', 'g1', 'E'), true);
});

test('a short game: each player sees only their own hand, the table sees none', () => {
  const manager = gameWith(...NAMES);
  // The bidding and two tricks
  for (let i = 0; i < 4 + 8; i++) step(manager);
  const views = [1, 2, 3, 4].map(seat => viewOf(manager, seat));
  views.forEach((view, index) => assert.equal(view.hand.length, view.handCounts[index + 1]));
  assert.notDeepEqual(views[0].hand, views[1].hand);
  assert.deepEqual(views[0].bids, { 1: 3, 2: 0, 3: 3, 4: 3 });

  const history = manager.history('spades', 'g1') as unknown as PublicGameState[];
  assert.equal(history.length, 13);
  for (const state of [...history, viewOf(manager, null)]) {
    assert.deepEqual(state.hand, []);
    assert.equal('hands' in state, false);
  }
});

test('a rejoin mid-turn shows the same half-finished trick, bids and hand', () => {
  const manager = gameWith(...NAMES);
  // The bidding and two cards of the first trick
  for (let i = 0; i < 4 + 2; i++) step(manager);
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  const before = viewOf(manager, seat);
  assert.equal(before.trick.length, 2);
  manager.disconnect(ROOM, seat);
  assert.deepEqual(viewOf(manager, null).disconnected, [seat]);
  const back = manager.join('spades', 'g1', NAMES[seat - 1], true);
  if ('error' in back) assert.fail(back.error);
  const after = back.state as PublicGameState;
  assert.deepEqual(after.hand, before.hand);
  assert.deepEqual(after.trick, before.trick);
  assert.deepEqual(after.bids, before.bids);
  assert.equal(after.currentPlayer, seat);
  ok(manager.move(ROOM, seat, anyMove(after, seat)));
});

test('undo restores the bidding', () => {
  const manager = gameWith(...NAMES);
  step(manager);
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  ok(manager.move(ROOM, seat, { type: 'bid', tricks: 5 }));
  ok(manager.requestUndo(ROOM, seat));
  for (const other of [1, 2, 3, 4].filter(s => s !== seat)) manager.voteUndo(ROOM, other, true);
  const restored = viewOf(manager, null);
  assert.equal(restored.currentPlayer, seat);
  assert.deepEqual(restored.bids, { 1: 3 });
});

test('a whole game played with legal moves ends at 500 or -200', () => {
  const manager = gameWith(...NAMES);
  let state = viewOf(manager, null);
  for (let moves = 0; !state.isGameOver && moves < 50000; moves++) state = step(manager);
  assert.equal(state.isGameOver, true);
  assert.equal(state.winners.length, 2);
  assert.ok(Math.max(...state.scores) >= targetScore(state) || Math.min(...state.scores) <= LOSING_SCORE);
  assert.ok(state.handNumber > 1);
  const file = manager.gameFile('spades', 'g1', new Date());
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
