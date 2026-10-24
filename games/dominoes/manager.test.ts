import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys } from '../../server/testing.ts';
import { legalPlays, stuckMove, targetScore } from './rules.ts';
import { dominoes } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { HouseRuleValues } from '../../shared/houseRules.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'dominoes/g1';

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

function seatAll(names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([dominoes], seeded(1)));
  for (const name of names) manager.join('dominoes', 'g1', name);
  return manager;
}

function gameWith(...names: string[]): Manager {
  const manager = seatAll(names);
  agreeAll(manager, ROOM);
  return manager;
}

// The host sets `values` after everyone has joined, then everyone agrees
function gameWithRules(values: HouseRuleValues, ...names: string[]): Manager {
  const manager = seatAll(names);
  ok(manager.setHouseRules(ROOM, 1, { values, override: false, maxPlayers: null }));
  agreeAll(manager, ROOM);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to this game's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: number | null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

// The first tile that fits, else draw, else pass
function anyMove(view: PublicGameState, seat: number): Move {
  const [first] = legalPlays(view, seat, view.hand);
  if (first) return { type: 'play', ...first };
  return { type: stuckMove(view, seat, view.hand, view.boneyardCount) ?? 'pass' };
}

// After a round everyone continues
function step(manager: Manager): PublicGameState {
  const state = viewOf(manager, null);
  if (state.roundSummary) {
    for (const seat of state.activePlayers) ok(manager.action(ROOM, seat, { type: 'acknowledgeRound' }));
    return viewOf(manager, null);
  }
  const seat = state.currentPlayer;
  if (seat === null) assert.fail('nobody to move');
  return ok(manager.move(ROOM, seat, anyMove(viewOf(manager, seat), seat)));
}

test('each player sees only their own hand, and the history sees none', () => {
  const manager = gameWith('A', 'B', 'C');
  for (let i = 0; i < 6; i++) step(manager);

  const views = [1, 2, 3].map(seat => viewOf(manager, seat));
  views.forEach((view, index) => {
    assert.equal(view.hand.length, view.handCounts[index + 1]);
    for (const key of ['hands', 'boneyard']) assert.equal(key in view, false);
  });
  assert.notDeepEqual(views[0].hand, views[1].hand);

  const history = manager.history('dominoes', 'g1') as unknown as PublicGameState[];
  assert.equal(history.length, 7);
  for (const state of [...history, viewOf(manager, null)]) assert.deepEqual(state.hand, []);
});

test('the host\'s set reaches everyone and is dealt at once', () => {
  const manager = gameWithRules({ set: 9 }, 'A', 'B');
  for (const seat of [1, 2]) {
    const view = viewOf(manager, seat);
    assert.equal(view.set, 9);
    assert.equal(view.hand.length, 9);
    assert.equal(view.boneyardCount, 55 - 18);
  }
  step(manager);
  assert.deepEqual(manager.setHouseRules(ROOM, 1, { values: { set: 6 }, override: false, maxPlayers: null }),
    { error: 'The house rules are locked once play starts' });
  assert.equal(viewOf(manager, 1).set, 9);
});

test('moves are validated', () => {
  const manager = gameWith('A', 'B');
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  const other = seat === 1 ? 2 : 1;
  assert.deepEqual(manager.move('nope', seat, { type: 'draw' }), { error: 'Game not found' });
  assert.deepEqual(manager.move(ROOM, 3, { type: 'draw' }), { error: 'You are not in this game' });
  assert.deepEqual(manager.move(ROOM, other, { type: 'draw' }), { error: 'Not your turn' });
  assert.deepEqual(manager.move(ROOM, seat, { type: 'shout' }), { error: 'Invalid move' });
  assert.deepEqual(manager.move(ROOM, seat, { type: 'draw' }), { error: 'You have a tile that fits' });
  assert.equal(ok(manager.move(ROOM, seat, anyMove(viewOf(manager, seat), seat))).started, true);
});

test('a rejoin mid-turn shows the same line, hand and boneyard count', () => {
  const manager = gameWith('A', 'B');
  for (let i = 0; i < 5; i++) step(manager);
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  const before = viewOf(manager, seat);

  manager.disconnect(ROOM, seat);
  const rejoined = manager.join('dominoes', 'g1', seat === 1 ? 'A' : 'B', true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  const view = rejoined.state as PublicGameState;
  assert.equal(view.currentPlayer, seat);
  assert.deepEqual(view.hand, before.hand);
  assert.deepEqual(view.board, before.board);
  assert.equal(view.boneyardCount, before.boneyardCount);
});

test('undo restores the hand and line from before the move', () => {
  const manager = gameWith('A', 'B');
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  const before = viewOf(manager, seat);
  ok(manager.move(ROOM, seat, anyMove(before, seat)));
  ok(manager.requestUndo(ROOM, seat));
  ok(manager.voteUndo(ROOM, seat === 1 ? 2 : 1, true));
  const restored = viewOf(manager, seat);
  assert.deepEqual(restored.hand, before.hand);
  assert.deepEqual(restored.board, before.board);
  assert.equal(restored.currentPlayer, seat);
});

test('a whole game played with legal moves ends when someone reaches the target score', () => {
  const manager = gameWith('A', 'B', 'C', 'D');
  let state = viewOf(manager, null);
  for (let moves = 0; !state.isGameOver && moves < 50000; moves++) state = step(manager);
  assert.equal(state.isGameOver, true);
  assert.equal(state.winners.length, 1);
  assert.ok(state.scores[state.winners[0]] >= targetScore(4));
  assert.ok(state.roundNumber >= 1);
});

test('dismissing a player mid-game skips their seat', () => {
  const manager = gameWith('A', 'B', 'C');
  step(manager);
  manager.disconnect(ROOM, 3);
  ok(manager.requestDismiss(ROOM, 1, 3));
  const state = ok(manager.voteDismiss(ROOM, 2, true));
  assert.deepEqual(state.activePlayers, [1, 2]);
  assert.equal('3' in state.handCounts, false);
  assert.notEqual(state.currentPlayer, 3);
});
