import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from './games.ts';
import { rememberingKeys } from './testing.ts';
import { openGameStore } from './store.ts';
import type { GameStore } from './store.ts';
import { handGame, type HandState } from '../shared/testGame.ts';
import { MAX_SPECTATORS } from '../shared/spectators.ts';
import type { BasePublicState, Random, Result } from '../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const tick = { type: 'tick' };
const ROOM = 'test/g1';
const seededRandom: Random = () => 0.5;

function newManager(store: GameStore = openGameStore(':memory:'), keys = new Map<string, string>()): Manager {
  return rememberingKeys(createGameManager([handGame], seededRandom, store), keys);
}

function gameWith(...names: string[]): Manager {
  const manager = newManager();
  for (const name of names) manager.join('test', 'g1', name);
  return manager;
}

function watcher(manager: Manager, name: string, rejoin?: boolean) {
  const result = manager.join('test', 'g1', name, rejoin, undefined, 'spectator');
  if ('error' in result) assert.fail(result.error);
  assert.ok(result.spectatorId);
  return { ...result, spectatorId: result.spectatorId };
}

function ok(result: Result<unknown>): BasePublicState {
  if ('error' in result) assert.fail(result.error);
  return result.state as BasePublicState;
}

test('watching needs an existing game', () => {
  assert.deepEqual(newManager().join('test', 'none', 'Dana', false, undefined, 'spectator'), { error: 'Game not found' });
});

test('a spectator joins with no seat and sees no hand', () => {
  const manager = gameWith('Alice', 'Bob');
  const dana = watcher(manager, 'Dana');
  assert.equal(dana.seat, null);
  const text = JSON.stringify(manager.getSpectatorState(ROOM, dana.spectatorId));
  assert.ok(!text.includes('card1') && !text.includes('card2'));
  for (const seat of [1, 2]) {
    const view = manager.getState(ROOM, seat) as BasePublicState;
    assert.deepEqual(view.spectators, [{ id: dana.spectatorId, name: 'Dana', tableScreen: false, allowedSeats: [] }]);
    assert.ok(!JSON.stringify(view).includes(dana.seatKey));
  }
});

test('spectator and player names are unique together', () => {
  const manager = gameWith('Alice');
  watcher(manager, 'Dana');
  const taken = { error: 'That name is taken in this game' };
  assert.deepEqual(manager.join('test', 'g1', 'dana'), taken);
  assert.deepEqual(manager.join('test', 'g1', 'ALICE', false, undefined, 'spectator'), taken);
});

test('a spectator takes their entry back with the key', () => {
  const manager = gameWith('Alice', 'Bob');
  const dana = watcher(manager, 'Dana');
  assert.deepEqual(manager.join('test', 'g1', 'Dana', true, undefined, 'spectator'), { error: 'Dana is already in this game' });
  manager.disconnectSpectator(ROOM, dana.spectatorId);
  assert.deepEqual(manager.join('test', 'g1', 'Dana', false, 'wrong', 'spectator'), { error: 'That name is taken in this game' });
  assert.equal(watcher(manager, 'Dana', true).spectatorId, dana.spectatorId);
  assert.deepEqual(manager.join('test', 'g1', 'Eli', true, undefined, 'spectator'), { error: 'You are not in this game' });
});

test('twenty spectators at most', () => {
  const manager = gameWith('Alice', 'Bob');
  for (let i = 0; i < MAX_SPECTATORS; i++) watcher(manager, `Viewer${i}`);
  assert.deepEqual(manager.join('test', 'g1', 'Late', false, undefined, 'spectator'), { error: 'Too many people are watching this game' });
});

test('switching to player works only in the lobby', () => {
  const manager = gameWith('Alice', 'Bob', 'Cy');
  const dana = watcher(manager, 'Dana');
  const eli = watcher(manager, 'Eli');
  const result = manager.switchToPlayer(ROOM, dana.spectatorId);
  assert.ok('seat' in result);
  assert.equal(result.seat, 4);
  assert.deepEqual((manager.getState(ROOM, 1) as BasePublicState).spectators?.map(s => s.name), ['Eli']);
  ok(manager.move(ROOM, 1, tick));
  assert.deepEqual(manager.switchToPlayer(ROOM, eli.spectatorId), {
    error: 'The game has started; keep watching until the rematch'
  });
});

test('an undo keeps spectators', () => {
  const manager = gameWith('Alice', 'Bob');
  ok(manager.move(ROOM, 1, tick));
  const dana = watcher(manager, 'Dana');
  ok(manager.requestUndo(ROOM, 2));
  ok(manager.voteUndo(ROOM, 1, true));
  const state = manager.rawState(ROOM) as HandState;
  assert.equal(state.moves, 0);
  assert.deepEqual(state.spectators?.map(s => s.name), ['Dana']);
  assert.equal(typeof state.spectatorKeys?.[dana.spectatorId], 'string');
});

test('history and the game file carry no spectator data', () => {
  const manager = gameWith('Alice', 'Bob');
  const dana = watcher(manager, 'Dana');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  ok(manager.move(ROOM, 1, tick));
  const text = JSON.stringify([manager.history('test', 'g1'), manager.gameFile('test', 'g1', new Date(0))]);
  for (const leak of [dana.seatKey, 'spectatorKeys', 'handRequests', 'spectators', 'seatViews']) {
    assert.ok(!text.includes(leak), leak);
  }
});

test('spectators survive a restart', () => {
  const store = openGameStore(':memory:');
  const keys = new Map<string, string>();
  const manager = newManager(store, keys);
  manager.join('test', 'g1', 'Alice');
  manager.join('test', 'g1', 'Bob');
  const dana = watcher(manager, 'Dana');
  ok(manager.move(ROOM, 1, tick));
  const restarted = newManager(store, keys);
  assert.deepEqual((restarted.rawState(ROOM) as HandState).spectators?.map(s => s.name), ['Dana']);
  assert.deepEqual((restarted.getState(ROOM) as BasePublicState).spectators, []);
  assert.equal(watcher(restarted, 'Dana', true).spectatorId, dana.spectatorId);
});

test('a room saved before spectators loads', () => {
  const store = openGameStore(':memory:');
  const source = gameWith('Alice', 'Bob');
  ok(source.move(ROOM, 1, tick));
  const { spectators: _s, spectatorKeys: _k, handRequests: _h, ...old } = source.rawState(ROOM) as HandState;
  store.save(ROOM, 'test', old as HandState);
  assert.ok(watcher(newManager(store), 'Dana').spectatorId);
});
