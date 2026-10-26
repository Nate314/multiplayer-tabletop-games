import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { rememberingKeys, stepsOf } from '../../server/testing.ts';
import { skipbo } from './index.ts';
import { fits } from './rules.ts';
import type { PublicGameState } from './types.ts';
import type { Result, Seat } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'skipbo/g1';

// A repeatable random, so every run deals the same cards
function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

function gameWith(...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([skipbo], seeded(42)));
  for (const name of names) manager.join('skipbo', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Skip-Bo's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: Seat | null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

// One move for the current player as they see the table: the stock first, then a hand card, else a discard
function step(manager: Manager): PublicGameState {
  const seat = viewOf(manager, null).currentPlayer as Seat;
  const view = viewOf(manager, seat);
  const top = view.stockTops[seat];
  for (let to = 0; to < 4; to++) {
    if (top && fits(top, view.building[to])) return ok(manager.move(ROOM, seat, { type: 'play', from: { kind: 'stock' }, to }));
  }
  for (let to = 0; to < 4; to++) {
    const index = view.myHand.findIndex(card => fits(card, view.building[to]));
    if (index >= 0) return ok(manager.move(ROOM, seat, { type: 'play', from: { kind: 'hand', index }, to }));
  }
  if (view.myHand.length === 0) return ok(manager.move(ROOM, seat, { type: 'endTurn' }));
  return ok(manager.move(ROOM, seat, { type: 'discard', handIndex: 0, pile: 0 }));
}

test('each player sees only their own hand, and the history sees no hand', () => {
  const manager = gameWith('A', 'B');
  const alice = viewOf(manager, 1);
  assert.equal(alice.myHand.length, 5);
  assert.deepEqual(viewOf(manager, 2).myHand, []);
  assert.deepEqual(alice.handCounts, { 1: 5, 2: 0 });
  assert.deepEqual(alice.stockCounts, { 1: 30, 2: 30 });
  assert.equal(alice.drawCount, 162 - 60 - 5);
  for (const view of [alice, viewOf(manager, null)]) {
    assert.equal('hands' in view || 'stocks' in view || 'drawPile' in view, false);
  }

  for (let moves = 0; moves < 12; moves++) step(manager);
  const history = stepsOf(manager, 'skipbo') as unknown as PublicGameState[];
  assert.equal(history.length, 13);
  for (const past of history) assert.deepEqual(past.myHand, []);
});

test('a rejoin mid-turn shows the same half-finished turn', () => {
  const manager = gameWith('A', 'B');
  let state = viewOf(manager, null);
  // Play until someone is mid-turn: a card on a building pile and the turn still theirs
  for (let moves = 0; moves < 200 && !(state.lastMove?.type === 'play'); moves++) state = step(manager);
  assert.equal(state.lastMove?.type, 'play');
  const seat = state.currentPlayer as Seat;
  const before = viewOf(manager, seat);

  manager.disconnect(ROOM, seat);
  assert.deepEqual(viewOf(manager, null).disconnected, [seat]);
  const rejoined = manager.join('skipbo', 'g1', seat === 1 ? 'A' : 'B', true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  assert.equal(rejoined.seat, seat);
  const after = rejoined.state as PublicGameState;
  assert.deepEqual(after.myHand, before.myHand);
  assert.deepEqual(after.building, before.building);
  assert.deepEqual(after.discards, before.discards);
  assert.equal(after.currentPlayer, seat);
  ok(manager.move(ROOM, seat, after.myHand.length > 0 ? { type: 'discard', handIndex: 0, pile: 1 } : { type: 'endTurn' }));
});

test('undo puts a played card back', () => {
  const manager = gameWith('A', 'B');
  const before = viewOf(manager, 1);
  ok(manager.move(ROOM, 1, { type: 'discard', handIndex: 0, pile: 0 }));
  assert.equal(viewOf(manager, 2).myHand.length, 5);
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  const restored = viewOf(manager, 1);
  assert.deepEqual(restored.myHand, before.myHand);
  assert.equal(restored.currentPlayer, 1);
  assert.deepEqual(viewOf(manager, 2).myHand, []);
});

test('dismissing the player whose turn it is starts the next turn', () => {
  const manager = gameWith('A', 'B', 'C');
  ok(manager.move(ROOM, 1, { type: 'discard', handIndex: 0, pile: 0 }));
  assert.equal(viewOf(manager, null).currentPlayer, 2);
  manager.disconnect(ROOM, 2);
  ok(manager.requestDismiss(ROOM, 1, 2));
  const state = ok(manager.voteDismiss(ROOM, 3, true));
  assert.deepEqual(state.activePlayers, [1, 3]);
  assert.equal(state.currentPlayer, 3);
  assert.equal(viewOf(manager, 3).myHand.length, 5);
  assert.equal('2' in state.stockCounts, false);
});
