import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys, stepsOf, fileOf } from '../../server/testing.ts';
import { rummikub } from './index.ts';
import type { PublicGameState } from './types.ts';
import type { Result, Seat } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'rummikub/g1';
const DRAW = { type: 'draw' };

// A repeatable random, so every run deals the same tiles
function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

function gameWith(...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([rummikub], seeded(7)));
  for (const name of names) manager.join('rummikub', 'g1', name);
  agreeAll(manager, ROOM);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Rummikub's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: Seat | null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

function current(manager: Manager): Seat {
  const seat = viewOf(manager, null).currentPlayer;
  assert.ok(seat !== null);
  return seat;
}

test('each player sees only their own rack, and the pool only as a count', () => {
  const manager = gameWith('A', 'B');
  const alice = viewOf(manager, 1);
  const bob = viewOf(manager, 2);
  assert.equal(alice.rack.length, 14);
  assert.equal(bob.rack.length, 14);
  assert.ok(bob.rack.every(id => !alice.rack.includes(id)));
  assert.deepEqual(alice.rackCounts, { 1: 14, 2: 14 });
  assert.equal(alice.poolCount, 106 - 28);
  for (const view of [alice, bob, viewOf(manager, null)]) {
    assert.equal('racks' in view, false);
    assert.equal('pool' in view, false);
  }
  assert.deepEqual(viewOf(manager, null).rack, []);
});

test('moves are validated and a draw passes the turn', () => {
  const manager = gameWith('A', 'B');
  const first = current(manager);
  const other = first === 1 ? 2 : 1;
  assert.deepEqual(manager.move(ROOM, other, DRAW), { error: 'Not your turn' });
  assert.deepEqual(manager.move(ROOM, first, { type: 'nonsense' }), { error: 'Invalid move' });
  const rack = viewOf(manager, first).rack;
  assert.deepEqual(manager.move(ROOM, first, { type: 'play', table: [rack.slice(0, 1)] }), { error: 'Group 1 is not a valid set or run' });
  const after = ok(manager.move(ROOM, first, DRAW));
  assert.equal(after.started, true);
  assert.equal(after.currentPlayer, other);
  assert.equal(viewOf(manager, first).rack.length, 15);
});

test('a rejoin mid-turn shows the same table, rack and turn', () => {
  const manager = gameWith('A', 'B');
  const first = current(manager);
  ok(manager.move(ROOM, first, DRAW));
  const waiting = current(manager);
  const before = viewOf(manager, waiting);

  manager.disconnect(ROOM, waiting);
  assert.deepEqual(viewOf(manager, null).disconnected, [waiting]);
  const rejoined = manager.join('rummikub', 'g1', before.playerNames[waiting], true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  const after = viewOf(manager, waiting);
  assert.deepEqual(after.rack, before.rack);
  assert.deepEqual(after.table, before.table);
  assert.equal(after.currentPlayer, waiting);
  assert.deepEqual(after.disconnected, []);
});

test('an undo puts a drawn tile back', () => {
  const manager = gameWith('A', 'B');
  const first = current(manager);
  const other = first === 1 ? 2 : 1;
  const before = viewOf(manager, first);
  ok(manager.move(ROOM, first, DRAW));
  ok(manager.requestUndo(ROOM, other));
  const restored = ok(manager.voteUndo(ROOM, first, true));
  assert.equal(restored.currentPlayer, first);
  assert.deepEqual(viewOf(manager, first).rack, before.rack);
  assert.equal(viewOf(manager, first).poolCount, before.poolCount);
});

test('a dismissed player puts their tiles back, and the history and game file hide every rack', () => {
  const manager = gameWith('A', 'B', 'C');
  for (let turn = 0; turn < 3; turn++) ok(manager.move(ROOM, current(manager), DRAW));
  const target = current(manager);
  const poolBefore = viewOf(manager, null).poolCount;
  const targetTiles = viewOf(manager, target).rack.length;
  manager.disconnect(ROOM, target);
  const voters = viewOf(manager, null).activePlayers.filter(seat => seat !== target);
  ok(manager.requestDismiss(ROOM, voters[0], target));
  const state = ok(manager.voteDismiss(ROOM, voters[1], true));
  assert.deepEqual(state.activePlayers, voters);
  assert.equal(state.poolCount, poolBefore + targetTiles);
  assert.notEqual(state.currentPlayer, target);
  assert.ok('state' in manager.move(ROOM, state.currentPlayer ?? 0, DRAW), 'the game goes on');

  // The other two leave too, so the game ends and its file can be downloaded
  const [stay, leave] = voters;
  manager.disconnect(ROOM, leave);
  // The only player still connected asks, and that settles the vote
  const ended = ok(manager.requestDismiss(ROOM, stay, leave));
  assert.equal(ended.isGameOver, true);

  const steps = stepsOf(manager, 'rummikub') as unknown as PublicGameState[] | null;
  assert.ok(steps && steps.length >= 5);
  for (const step of steps) {
    assert.deepEqual(step.rack, []);
    assert.equal('racks' in step, false);
    assert.equal('pool' in step, false);
  }

  const file = fileOf(manager, 'rummikub', new Date(0));
  assert.ok(file && 'file' in file);
  const views = file.file.steps[1].views as unknown as Record<Seat, PublicGameState> | undefined;
  assert.ok(views);
  assert.equal(views[1].rack.length, 14);
  assert.equal((file.file.steps[1] as unknown as PublicGameState).rack.length, 0);
});
