import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys } from '../../server/testing.ts';
import { phase10 } from './index.ts';
import type { PublicGameState } from './types.ts';
import type { Result, Seat } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'phase10/g1';
const drawPile = { type: 'draw', source: 'pile' };

// A repeatable random, so every run deals the same cards
function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

function gameWith(...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([phase10], seeded(42)));
  for (const name of names) manager.join('phase10', 'g1', name);
  agreeAll(manager, ROOM);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Phase 10's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: Seat | null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

// Draws from the pile and discards the first card that is not a Skip, as `seat` sees their own hand
function playTurn(manager: Manager, seat: Seat): PublicGameState {
  const drawn = ok(manager.move(ROOM, seat, drawPile));
  const card = drawn.myHand.find(candidate => candidate.kind !== 'skip') ?? drawn.myHand[0];
  const skip = card.kind === 'skip' ? drawn.activePlayers.find(other => other !== seat) ?? null : null;
  return ok(manager.move(ROOM, seat, { type: 'discard', card: card.id, skip }));
}

test('each player sees only their own hand, and the history sees no hand', () => {
  const manager = gameWith('A', 'B');
  const alice = viewOf(manager, 1);
  const bob = viewOf(manager, 2);
  assert.equal(alice.myHand.length, 10);
  assert.equal(bob.myHand.length, 10);
  const aliceIds = new Set(alice.myHand.map(card => card.id));
  assert.ok(bob.myHand.every(card => !aliceIds.has(card.id)));
  assert.deepEqual(alice.handCounts, { 1: 10, 2: 10 });
  assert.equal(alice.drawCount, 108 - 21);
  for (const view of [alice, bob, viewOf(manager, null)]) {
    assert.equal('hands' in view, false);
    assert.equal('drawPile' in view, false);
    assert.equal('discardPile' in view, false);
  }

  playTurn(manager, 1);
  const history = manager.history('phase10', 'g1');
  assert.ok(history);
  assert.equal(history.length, 3);
  for (const step of history as unknown as PublicGameState[]) {
    assert.deepEqual(step.myHand, []);
    assert.equal('hands' in step, false);
  }
  // A card drawn from the pile is not named in the history
  assert.deepEqual((history[1] as unknown as PublicGameState).lastMove, { playerNumber: 1, type: 'draw', source: 'pile' });
});

test('a turn stays with the player until they discard', () => {
  const manager = gameWith('A', 'B');
  assert.deepEqual(manager.move(ROOM, 2, drawPile), { error: 'Not your turn' });
  const drawn = ok(manager.move(ROOM, 1, drawPile));
  assert.equal(drawn.currentPlayer, 1);
  assert.equal(drawn.started, true);
  assert.equal(viewOf(manager, 1).myHand.length, 11);
  assert.equal(viewOf(manager, 2).handCounts[1], 11);

  const card = viewOf(manager, 1).myHand.find(candidate => candidate.kind !== 'skip');
  assert.ok(card);
  const discarded = ok(manager.move(ROOM, 1, { type: 'discard', card: card.id, skip: null }));
  assert.equal(discarded.currentPlayer, 2);
  assert.equal(discarded.discardTop?.id, card.id);
});

test('undo restores the state before a move', () => {
  const manager = gameWith('A', 'B');
  const before = viewOf(manager, 1);
  ok(manager.move(ROOM, 1, drawPile));
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  const restored = viewOf(manager, 1);
  assert.deepEqual(restored.myHand, before.myHand);
  assert.equal(restored.drawnBy, null);
  assert.equal(restored.drawCount, before.drawCount);
});

test('several turns pass around the table', () => {
  const manager = gameWith('A', 'B', 'C');
  for (let turn = 0; turn < 9; turn++) {
    const state = viewOf(manager, null);
    if (state.currentPlayer === null) assert.fail('nobody to move');
    playTurn(manager, state.currentPlayer);
  }
  const state = viewOf(manager, 1);
  assert.equal(Object.values(state.handCounts).reduce((sum, count) => sum + count, 0), 30);
});

test('an unknown action is refused, and there is nothing to continue mid-hand', () => {
  const manager = gameWith('A', 'B');
  assert.deepEqual(manager.action(ROOM, 1, { type: 'nonsense' }), { error: 'Unknown action' });
  assert.deepEqual(manager.action(ROOM, 1, { type: 'acknowledgeHand' }), { error: 'Nothing to continue' });
});
