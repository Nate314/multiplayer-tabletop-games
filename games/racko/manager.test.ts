import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys } from '../../server/testing.ts';
import { racko } from './index.ts';
import type { PublicGameState } from './types.ts';
import type { Result, Seat } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'racko/g1';

// A repeatable random, so every run deals the same cards
function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

function gameWith(...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([racko], seeded(42)));
  for (const name of names) manager.join('racko', 'g1', name);
  agreeAll(manager, ROOM);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Rack-O's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: Seat | null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

// A whole turn: draw from the deck and put the card in slot 0 until the round ends
function playTurn(manager: Manager): PublicGameState {
  const seat = viewOf(manager, null).currentPlayer as Seat;
  ok(manager.move(ROOM, seat, { type: 'draw', from: 'deck' }));
  return ok(manager.move(ROOM, seat, { type: 'place', slot: viewOf(manager, null).moveCount % 10 }));
}

test('each player sees only their own rack, and the history sees none', () => {
  const manager = gameWith('A', 'B');
  const alice = viewOf(manager, 1);
  assert.equal(alice.myRack.length, 10);
  assert.notDeepEqual(viewOf(manager, 2).myRack, alice.myRack);
  assert.deepEqual(viewOf(manager, null).myRack, []);
  assert.equal(alice.drawCount, 40 - 20 - 1);
  for (const view of [alice, viewOf(manager, null)]) {
    assert.equal('racks' in view || 'drawPile' in view || 'held' in view, false);
  }

  for (let turns = 0; turns < 6; turns++) playTurn(manager);
  const history = manager.history('racko', 'g1') as unknown as PublicGameState[];
  assert.equal(history.length, 13);
  for (const past of history) assert.deepEqual(past.myRack, []);
});

test('a rejoin mid-turn shows the card that was drawn from the deck', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, { type: 'draw', from: 'deck' }));
  const before = viewOf(manager, 1);
  assert.equal(typeof before.myHeld, 'number');
  assert.equal(viewOf(manager, 2).myHeld, null);
  assert.equal(viewOf(manager, 2).heldFrom, 'deck');

  manager.disconnect(ROOM, 1);
  assert.deepEqual(viewOf(manager, null).disconnected, [1]);
  const rejoined = manager.join('racko', 'g1', 'A', true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  assert.equal(rejoined.seat, 1);
  const after = rejoined.state as PublicGameState;
  assert.equal(after.myHeld, before.myHeld);
  assert.deepEqual(after.myRack, before.myRack);
  assert.equal(after.currentPlayer, 1);
  ok(manager.move(ROOM, 1, { type: 'discard' }));
  assert.equal(viewOf(manager, null).currentPlayer, 2);
});

test('undo puts a draw back, and the next draw is a reshuffled pile', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, { type: 'draw', from: 'deck' }));
  ok(manager.requestUndo(ROOM, 1));
  const restored = ok(manager.voteUndo(ROOM, 2, true));
  assert.equal(restored.heldFrom, null);
  assert.equal(restored.currentPlayer, 1);
  assert.equal(restored.drawCount, 19);
});

test('dismissing the player whose turn it is hands the turn on', () => {
  const manager = gameWith('A', 'B', 'C');
  ok(manager.move(ROOM, 1, { type: 'draw', from: 'discard' }));
  ok(manager.move(ROOM, 1, { type: 'place', slot: 0 }));
  ok(manager.move(ROOM, 2, { type: 'draw', from: 'deck' }));
  manager.disconnect(ROOM, 2);
  ok(manager.requestDismiss(ROOM, 1, 2));
  const state = ok(manager.voteDismiss(ROOM, 3, true));
  assert.deepEqual(state.activePlayers, [1, 3]);
  assert.equal(state.currentPlayer, 3);
  assert.equal(state.heldFrom, null);
  assert.equal(state.drawCount + state.discardCount + 20, 50);
  ok(manager.move(ROOM, 3, { type: 'draw', from: 'deck' }));
});

test('a round ends, Continue deals the next, and the scoring screen needs every player', () => {
  const manager = gameWith('A', 'B');
  let state = viewOf(manager, null);
  // Swap cards in slot order until someone calls Rack-O (a few hundred turns at most)
  for (let turns = 0; turns < 2000 && !state.roundSummary; turns++) {
    const seat = state.currentPlayer as Seat;
    const view = viewOf(manager, seat);
    ok(manager.move(ROOM, seat, { type: 'draw', from: 'deck' }));
    const card = viewOf(manager, seat).myHeld as number;
    // The slot whose number range the card belongs in, an easy way to climb toward order
    const slot = Math.min(9, Math.floor((card - 1) / 4));
    state = view.myRack[slot] === card ? ok(manager.move(ROOM, seat, { type: 'discard' })) : ok(manager.move(ROOM, seat, { type: 'place', slot }));
  }
  assert.ok(state.roundSummary, 'expected a round to end');
  assert.equal(state.currentPlayer, null);
  const caller = state.roundSummary.caller;
  assert.equal(state.scores[caller], 75);
  ok(manager.action(ROOM, 1, { type: 'acknowledgeRound' }));
  assert.equal(viewOf(manager, null).round, 1);
  const next = ok(manager.action(ROOM, 2, { type: 'acknowledgeRound' }));
  assert.equal(next.round, 2);
  assert.equal(next.currentPlayer, 2);
  assert.equal(next.roundSummary, null);
  assert.equal(next.scores[caller], 75);
});
