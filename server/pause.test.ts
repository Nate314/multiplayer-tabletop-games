import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager, EMPTY_ROOM_TIMEOUT_MS, NOT_AVAILABLE } from './games.ts';
import { openGameStore, type GameStore } from './store.ts';
import { rememberingKeys } from './testing.ts';
import { openSeal } from './pauseSeal.ts';
import { sealedRoomOf } from './pauseFiles.ts';
import { handGame, testGame, type TestPublicState, type TestState } from '../shared/testGame.ts';
import { SIMULATION_TICK_MS, type GameDefinition } from '../shared/gameDefinition.ts';
import { asRecord } from '../shared/messages.ts';
import type { PauseFile } from '../shared/pauseFile.ts';
import type { BaseGameState, Random, Result } from '../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'test/g1';
const tick = { type: 'tick' };
const DEVICE = 'device-0123456789-abcdef';
const PAUSED_AT = new Date('2026-10-31T12:00:00Z');
const seededRandom: Random = () => 0.5;

function ok(result: Result<unknown>): TestPublicState {
  if ('error' in result) assert.fail(result.error);
  return result.state as TestPublicState;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function managerFor(game: GameDefinition<any, any> = handGame, store?: GameStore, keys = new Map<string, string>()) {
  const clock = { now: 100_000 };
  const manager = rememberingKeys(createGameManager([game], seededRandom, store, { now: () => clock.now }), keys);
  return { manager, clock, keys };
}

// Alice (seat 1) and Bob (seat 2) after Alice's first tick, so it is Bob's turn
function started(game?: GameDefinition<any, any>, store?: GameStore, keys?: Map<string, string>): Manager { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { manager } = managerFor(game, store, keys);
  manager.join('test', 'g1', 'Alice', undefined, undefined, undefined, DEVICE);
  manager.join('test', 'g1', 'Bob');
  ok(manager.move(ROOM, 1, tick));
  return manager;
}

function paused(manager: Manager): Manager {
  ok(manager.requestPause(ROOM, 1));
  ok(manager.votePause(ROOM, 2, true));
  return manager;
}

function keyOf(manager: Manager, seat: number): string {
  return manager.rawState(ROOM)?.seatKeys?.[seat] as string;
}

function fileOf(manager: Manager, seat: unknown, credential: unknown): PauseFile {
  const result = manager.pauseFile('test', 'g1', seat, credential, PAUSED_AT);
  if ('error' in result) assert.fail(result.error);
  return result.file;
}

test('a pause needs every seat and then closes the game for play', () => {
  const manager = started();
  const asked = ok(manager.requestPause(ROOM, 1));
  assert.equal(asked.paused, undefined);
  assert.equal(asked.gameStatus, 'Alice wants to pause the game');
  const state = ok(manager.votePause(ROOM, 2, true));
  assert.equal(state.paused, true);
  assert.equal(state.gameStatus, 'Game paused');
  assert.equal(state.pauseVote, null);
  assert.deepEqual(manager.move(ROOM, 2, tick), { error: 'The game is paused' });
  assert.deepEqual(manager.action(ROOM, 1, { type: 'ping' }), { error: 'The game is paused' });
  assert.deepEqual(manager.requestUndo(ROOM, 1), { error: 'The game is paused' });
  assert.deepEqual(manager.requestPause(ROOM, 1), { error: 'The game is already paused' });
});

test('a declined pause vote leaves play running', () => {
  const manager = started();
  ok(manager.requestPause(ROOM, 1));
  const state = ok(manager.votePause(ROOM, 2, false));
  assert.equal(state.gameStatus, 'Bob declined to pause');
  assert.equal(state.pauseVote, null);
  ok(manager.move(ROOM, 2, tick));
});

test('a pause vote blocks moves and other votes', () => {
  const manager = started();
  ok(manager.requestPause(ROOM, 1));
  assert.deepEqual(manager.move(ROOM, 2, tick), { error: 'A pause vote is in progress' });
  assert.deepEqual(manager.requestUndo(ROOM, 1), { error: 'A pause vote is in progress' });
  assert.deepEqual(manager.requestPause(ROOM, 2), { error: 'A vote is already in progress' });
});

test('a paused room outlives the empty-room timer', (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const manager = paused(started());
  manager.disconnect(ROOM, 1);
  manager.disconnect(ROOM, 2);
  t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS + 1);
  assert.equal(manager.getState(ROOM)?.paused, true);
});

test('a paused room survives a restart', (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const store = openGameStore(':memory:');
  const keys = new Map<string, string>();
  const first = paused(started(handGame, store, keys));
  const pause = first.rawState(ROOM)?.pause;
  assert.ok(pause);

  const { manager: back } = managerFor(handGame, store, keys);
  t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS + 1);
  const state = back.rawState(ROOM);
  assert.equal(state?.paused, true);
  assert.deepEqual(state?.pause, pause);
  assert.deepEqual(state?.disconnected, [1, 2]);
});

test('resume waits for everyone, then play continues on the same turn', () => {
  const manager = started();
  assert.deepEqual(manager.resumeGame(ROOM, 1), { error: 'The game is not paused' });
  paused(manager);
  manager.disconnect(ROOM, 2);
  assert.deepEqual(manager.resumeGame(ROOM, 1), { error: 'Waiting for Bob' });
  manager.join('test', 'g1', 'Bob', true);
  const state = ok(manager.resumeGame(ROOM, 1));
  assert.equal(state.gameStatus, 'Play resumed');
  assert.equal(state.paused, false);
  assert.equal(state.currentPlayer, 2);
  assert.equal(manager.rawState(ROOM)?.pause, undefined);
  assert.equal(ok(manager.move(ROOM, 2, tick)).moveCount, 2);
  assert.deepEqual(manager.resumeGame(ROOM, 1), { error: 'The game is not paused' });
});

test('no view carries the shares', () => {
  const manager = paused(started());
  const dana = manager.join('test', 'g1', 'Dana', undefined, undefined, 'spectator');
  assert.ok('spectatorId' in dana && dana.spectatorId);
  const shares = Object.values(manager.rawState(ROOM)!.pause!.shares);
  const steps = manager.history('test', 'g1', keyOf(manager, 1));
  assert.ok('steps' in steps);
  const texts = [
    ...[1, 2, null].map(seat => JSON.stringify(manager.getState(ROOM, seat))),
    ...steps.steps.map(step => JSON.stringify(step)),
    JSON.stringify(manager.getSpectatorState(ROOM, dana.spectatorId))
  ];
  for (const text of texts) {
    assert.ok(!text.includes('"pause"'));
    for (const share of shares) assert.ok(!text.includes(share));
  }
});

test('pauseFile gives each seat its own file', () => {
  const running = started();
  assert.deepEqual(running.pauseFile('test', 'g1', 1, keyOf(running, 1), PAUSED_AT), { error: NOT_AVAILABLE });

  const manager = paused(started());
  const file = fileOf(manager, 1, keyOf(manager, 1));
  assert.equal(file.seat, 1);
  assert.equal(file.playerName, 'Alice');
  assert.deepEqual(file.hand, handGame.privateSeatView!(manager.rawState(ROOM) as never, 1));
  assert.equal(file.share, manager.rawState(ROOM)!.pause!.shares[1]);
  assert.equal(file.pausedAt, PAUSED_AT.toISOString());
  assert.equal(fileOf(manager, 1, DEVICE).share, file.share);

  for (const [seat, credential] of [
    [1, keyOf(manager, 2)], [2, DEVICE], [1, 'wrong'], [1, undefined], [3, keyOf(manager, 1)], ['1', keyOf(manager, 1)], [1, 42]
  ] as const) {
    assert.deepEqual(manager.pauseFile('test', 'g1', seat, credential, PAUSED_AT), { error: NOT_AVAILABLE });
  }
  assert.deepEqual(manager.pauseFile('test', 'none', 1, keyOf(manager, 1), PAUSED_AT), { error: NOT_AVAILABLE });
  assert.deepEqual(manager.pauseFile('nope', 'g1', 1, keyOf(manager, 1), PAUSED_AT), { error: NOT_AVAILABLE });
});

test('the files of every seat open the seal', () => {
  const manager = paused(started());
  const file1 = fileOf(manager, 1, keyOf(manager, 1));
  const file2 = fileOf(manager, 2, keyOf(manager, 2));
  const room = { game: handGame, state: manager.rawState(ROOM)!, history: [], timeline: [] };
  const opened = openSeal(file1.seal, { 1: file1.share, 2: file2.share });
  assert.ok(opened);
  assert.deepEqual(opened.state, sealedRoomOf(room).state);
  assert.equal(opened.history.length, 1);
  assert.equal(opened.timeline.length, 1);
});

type RollState = TestState & { rolling: boolean; ticks: number; undone?: boolean };

// A game whose 'roll' starts a simulation that never settles on its own; an undo marks the state
const rollGame: GameDefinition<RollState, TestPublicState> = {
  ...(testGame as unknown as GameDefinition<RollState, TestPublicState>),
  createGameState: gameId => ({ ...testGame.createGameState(gameId), rolling: false, ticks: 0 }),
  applyMove(state, seat, move, random, now) {
    if (asRecord(move)?.type === 'roll') return { state: { ...state, rolling: true } };
    return testGame.applyMove(state, seat, move, random, now) as Result<RollState>;
  },
  simulating: state => state.rolling,
  simulate: state => ({ ...state, ticks: state.ticks + 1 }),
  onUndo: state => ({ ...state, undone: true })
};

test('a mid-simulation pause puts the action back', (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const manager = started(rollGame);
  ok(manager.move(ROOM, 2, { type: 'roll' }));
  t.mock.timers.tick(SIMULATION_TICK_MS);
  paused(manager);
  const state = manager.rawState(ROOM) as RollState;
  assert.equal(state.undone, true);
  const ticks = state.ticks;
  t.mock.timers.tick(SIMULATION_TICK_MS * 5);
  assert.equal((manager.rawState(ROOM) as RollState).ticks, ticks);
});

test('a disconnect while paused leaves the game alone', () => {
  const manager = paused(started());
  const { pause } = manager.rawState(ROOM)!;
  manager.disconnect(ROOM, 2);
  const live = manager.rawState(ROOM) as BaseGameState;
  assert.deepEqual(live.disconnected, [2]);
  assert.deepEqual(live.pause, pause);
  const opened = openSeal(pause!.seal, pause!.shares);
  assert.ok(opened);
  const room = sealedRoomOf({ game: handGame, state: { ...live, disconnected: [] }, history: [], timeline: [] });
  assert.deepEqual(opened.state, room.state);
});
