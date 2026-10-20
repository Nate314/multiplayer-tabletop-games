import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { rememberingKeys } from '../../server/testing.ts';
import { options } from './rules.ts';
import { holdem } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'holdem/g1';

// The same deal on every run
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
  const manager = rememberingKeys(createGameManager([holdem], seeded(1)));
  for (const name of names) manager.join('holdem', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Hold'em's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: number | null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

// Pushes every hand to a showdown: the first player to act goes all in and everyone calls
function anyMove(view: PublicGameState, seat: number): Move {
  const { canCheck, canRaise, maxTo } = options(view, seat);
  if (canRaise && view.currentBet < maxTo && Object.values(view.bets).every(bet => bet <= 20)) return { type: 'raise', to: maxTo };
  return canCheck ? { type: 'check' } : { type: 'call' };
}

// After a hand everyone continues
function step(manager: Manager): PublicGameState {
  const state = viewOf(manager, null);
  if (state.handResult) {
    for (const seat of state.activePlayers) {
      if (viewOf(manager, null).handResult) ok(manager.action(ROOM, seat, { type: 'acknowledgeRound' }));
    }
    return viewOf(manager, null);
  }
  const seat = state.currentPlayer ?? assert.fail('nobody to move');
  return ok(manager.move(ROOM, seat, anyMove(viewOf(manager, seat), seat)));
}

test('a whole game of all-ins ends when one player has every chip, and the history shows only shown hands', () => {
  const manager = gameWith('A', 'B', 'C');
  let state = viewOf(manager, null);
  for (let moves = 0; !state.isGameOver && moves < 2000; moves++) state = step(manager);
  assert.equal(state.isGameOver, true);
  assert.equal(state.winners.length, 1);
  assert.equal(state.chips[state.winners[0]], 3000);

  const history = manager.history('holdem', 'g1') as unknown as PublicGameState[];
  assert.ok(history.length > 2);
  for (const past of history) {
    assert.deepEqual(past.myCards, []);
    for (const key of ['holeCards', 'deck']) assert.equal(key in past, false);
  }
});

test('each player sees only their own hole cards', () => {
  const manager = gameWith('A', 'B', 'C');
  const views = [1, 2, 3].map(seat => viewOf(manager, seat));
  for (const view of views) assert.equal(view.myCards.length, 2);
  assert.notDeepEqual(views[0].myCards, views[1].myCards);
  assert.deepEqual(viewOf(manager, null).myCards, []);
});

test('a rejoin mid-turn shows the same betting round', () => {
  const manager = gameWith('A', 'B', 'C');
  ok(manager.move(ROOM, 1, { type: 'raise', to: 60 }));
  const before = viewOf(manager, 2);
  assert.equal(before.currentPlayer, 2);
  manager.disconnect(ROOM, 2);
  const rejoined = manager.join('holdem', 'g1', 'B', true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  const after = rejoined.state as PublicGameState;
  for (const key of ['currentPlayer', 'bets', 'currentBet', 'raiseSize', 'myCards', 'pots', 'chips', 'street'] as const) {
    assert.deepEqual(after[key], before[key]);
  }
  ok(manager.move(ROOM, 2, { type: 'call' }));
});

test('undo puts the bet back and reshuffles the deck', () => {
  const manager = gameWith('A', 'B');
  const before = viewOf(manager, 1);
  ok(manager.move(ROOM, 1, { type: 'raise', to: 100 }));
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  const restored = viewOf(manager, 1);
  assert.deepEqual(restored.myCards, before.myCards);
  assert.deepEqual(restored.bets, before.bets);
  assert.equal(restored.currentPlayer, 1);
});

test('dismissing the player whose turn it is folds them and play goes on', () => {
  const manager = gameWith('A', 'B', 'C');
  ok(manager.move(ROOM, 1, { type: 'call' }));
  manager.disconnect(ROOM, 2);
  ok(manager.requestDismiss(ROOM, 1, 2));
  const state = ok(manager.voteDismiss(ROOM, 3, true));
  assert.deepEqual(state.activePlayers, [1, 3]);
  assert.equal(state.currentPlayer, 3);
  assert.equal('2' in state.chips, false);
  assert.deepEqual((state as PublicGameState).folded, [2]);
});
