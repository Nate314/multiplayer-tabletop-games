import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameManager, EMPTY_ROOM_TIMEOUT_MS, MAX_RESUME_LOBBY_MS, NOT_AVAILABLE, PAUSED_ROOM_TTL_MS, type ManagerHooks
} from './games.ts';
import { openGameStore, type GameStore } from './store.ts';
import { rememberingKeys } from './testing.ts';
import { openSeal, shareHash } from './pauseSeal.ts';
import { sealedRoomOf } from './pauseFiles.ts';
import { hashDeviceId } from './devices.ts';
import { handGame, testGame, type HandPublicState, type TestPublicState, type TestState } from '../shared/testGame.ts';
import { SIMULATION_TICK_MS, type GameDefinition } from '../shared/gameDefinition.ts';
import { asRecord } from '../shared/messages.ts';
import type { PauseFile, ResumeStatus, ResumeUpload } from '../shared/pauseFile.ts';
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
function managerFor(game: GameDefinition<any, any> = handGame, store?: GameStore, keys = new Map<string, string>(), hooks: ManagerHooks = {}) {
  const clock = { now: 100_000 };
  const manager = rememberingKeys(createGameManager([game], seededRandom, store, { now: () => clock.now, ...hooks }), keys);
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

// Alice and Bob paused at clock.now, with the store and clock to move the server on
function pausedWithClock(store?: GameStore, keys = new Map<string, string>()) {
  const { manager, clock } = managerFor(handGame, store, keys);
  manager.join('test', 'g1', 'Alice');
  manager.join('test', 'g1', 'Bob');
  ok(manager.move(ROOM, 1, tick));
  paused(manager);
  return { manager, clock, keys };
}

const DAY_MS = 24 * 60 * 60 * 1000;

test('a paused room is deleted 30 days after the pause', (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { manager, clock } = pausedWithClock();
  assert.equal(manager.rawState(ROOM)?.pausedAt, clock.now);
  clock.now += PAUSED_ROOM_TTL_MS - DAY_MS;
  t.mock.timers.tick(DAY_MS);
  assert.equal(manager.rawState(ROOM)?.paused, true);
  clock.now += DAY_MS;
  t.mock.timers.tick(DAY_MS);
  assert.equal(manager.rawState(ROOM), undefined);
});

test('a restart deletes a game paused 30 days ago and keeps a newer one', () => {
  const store = openGameStore(':memory:');
  const { clock, keys } = pausedWithClock(store);
  const later = managerFor(handGame, store, keys, { now: () => clock.now + PAUSED_ROOM_TTL_MS - 1 }).manager;
  assert.equal(later.rawState(ROOM)?.paused, true);
  const expired = managerFor(handGame, store, keys, { now: () => clock.now + PAUSED_ROOM_TTL_MS }).manager;
  assert.equal(expired.rawState(ROOM), undefined);
  assert.equal(managerFor(handGame, store, keys).manager.rawState(ROOM), undefined); // gone from the store too
});

test('a resumed game is never deleted as an old pause', (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { manager, clock } = pausedWithClock();
  manager.resumeGame(ROOM, 1);
  assert.equal(manager.rawState(ROOM)?.pausedAt, undefined);
  clock.now += PAUSED_ROOM_TTL_MS;
  t.mock.timers.tick(DAY_MS);
  assert.equal(manager.rawState(ROOM)?.paused, false);
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

const BOB_DEVICE = 'device-bob-0123456789';
const MISMATCH = "Bob's pause file does not match the others";
const ANOTHER_GAME = 'Another game with this ID is on this server';
const WAITING = 'This game is waiting for its pause files. Choose Resume a game and upload yours';

function pauseFiles(): { original: Manager; alice: PauseFile; bob: PauseFile } {
  const original = paused(started());
  return { original, alice: fileOf(original, 1, keyOf(original, 1)), bob: fileOf(original, 2, keyOf(original, 2)) };
}

// A ResumeUpload carries `error: null`, so a refusal is told apart by its missing key
function uploaded(result: ResumeUpload | { error: string }): ResumeUpload {
  if (!('seatKey' in result)) assert.fail(result.error);
  return result;
}

function statusOf(manager: Manager, credential: unknown): ResumeStatus {
  const result = manager.resumeStatus('test', 'g1', credential);
  if (!('players' in result)) assert.fail(result.error);
  return result;
}

function rejoined(manager: Manager, name: string, seatKey: string): void {
  const result = manager.join('test', 'g1', name, true, seatKey);
  if ('error' in result) assert.fail(result.error);
}

// A new manager given both files, with both players back and play resumed
function resumedFromFiles(store?: GameStore) {
  const files = pauseFiles();
  const { manager } = managerFor(handGame, store);
  const alice = uploaded(manager.uploadPauseFile(files.alice, DEVICE)).seatKey;
  const bob = uploaded(manager.uploadPauseFile(files.bob, BOB_DEVICE)).seatKey;
  rejoined(manager, 'Alice', alice);
  rejoined(manager, 'Bob', bob);
  ok(manager.resumeGame(ROOM, 1));
  return { ...files, manager, alice, bob };
}

test('files resume a lost game in the same seats on the same turn', () => {
  const { original, alice, bob } = pauseFiles();
  const { manager } = managerFor();
  const first = uploaded(manager.uploadPauseFile(alice, DEVICE));
  assert.equal(first.ready, false);
  assert.equal(first.seat, 1);
  assert.equal(first.playerName, 'Alice');
  assert.deepEqual(first.players, [{ seat: 1, name: 'Alice', ready: true }, { seat: 2, name: 'Bob', ready: false }]);
  assert.deepEqual(statusOf(manager, first.seatKey).players, first.players);

  const second = uploaded(manager.uploadPauseFile(bob, BOB_DEVICE));
  assert.equal(second.ready, true);
  assert.equal(second.seat, 2);
  assert.notEqual(second.seatKey, first.seatKey);
  assert.ok(!JSON.stringify(second).includes(first.seatKey));
  assert.equal(manager.rawState(ROOM)?.paused, true);
  assert.deepEqual(manager.rawState(ROOM)?.disconnected, [1, 2]);
  assert.equal(statusOf(manager, first.seatKey).ready, true);

  rejoined(manager, 'Alice', first.seatKey);
  rejoined(manager, 'Bob', second.seatKey);
  const state = ok(manager.resumeGame(ROOM, 1));
  assert.equal(state.currentPlayer, original.rawState(ROOM)?.currentPlayer);
  for (const seat of [1, 2]) {
    assert.equal((manager.getState(ROOM, seat) as HandPublicState).hand, (original.getState(ROOM, seat) as HandPublicState).hand);
  }
  assert.deepEqual(manager.history('test', 'g1', first.seatKey), original.history('test', 'g1', keyOf(original, 1)));
  assert.equal(manager.rawState(ROOM)?.pause, undefined);
});

test('files downloaded after a player leaves and comes back still resume the game', () => {
  const original = paused(started());
  const alice = fileOf(original, 1, keyOf(original, 1));
  original.disconnect(ROOM, 2);
  rejoined(original, 'Bob', keyOf(original, 2));
  original.disconnect(ROOM, 1);
  const bob = fileOf(original, 2, keyOf(original, 2));
  const { manager } = managerFor();
  uploaded(manager.uploadPauseFile(alice, DEVICE));
  assert.equal(uploaded(manager.uploadPauseFile(bob, BOB_DEVICE)).ready, true);
});

test('the uploader\'s device takes the seat', () => {
  const { manager } = resumedFromFiles();
  assert.equal(manager.rawState(ROOM)?.seatDevices?.[1], hashDeviceId(DEVICE));
  assert.equal(manager.rawState(ROOM)?.seatDevices?.[2], hashDeviceId(BOB_DEVICE));
});

test('undo works after a resume from files', () => {
  const { manager, alice, bob } = resumedFromFiles();
  ok(manager.move(ROOM, 2, tick));
  for (const moveCount of [1, 0]) { // the second undo reaches the step from before the pause
    ok(manager.requestUndo(ROOM, 1));
    assert.equal(ok(manager.voteUndo(ROOM, 2, true)).moveCount, moveCount);
  }
  manager.disconnect(ROOM, 1);
  manager.disconnect(ROOM, 2);
  rejoined(manager, 'Alice', alice);
  rejoined(manager, 'Bob', bob);
});

test('a game resumed from files survives a restart', (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const store = openGameStore(':memory:');
  const { manager, original, alice } = resumedFromFiles(store);
  const steps = manager.history('test', 'g1', alice);
  assert.deepEqual(steps, original.history('test', 'g1', keyOf(original, 1)));
  const { manager: back } = managerFor(handGame, store);
  assert.deepEqual(back.history('test', 'g1', alice), steps);
  rejoined(back, 'Alice', alice);
});

test('a tampered file is refused and can be replaced', () => {
  const { alice, bob } = pauseFiles();
  const { manager } = managerFor();
  const first = uploaded(manager.uploadPauseFile(alice, DEVICE));
  assert.deepEqual(manager.uploadPauseFile({ ...bob, hand: { hand: 'card1' } }, BOB_DEVICE), { error: MISMATCH });
  const status = statusOf(manager, first.seatKey);
  assert.equal(status.error, MISMATCH);
  assert.equal(status.ready, false);
  assert.deepEqual(status.players.map(player => player.ready), [true, false]);
  assert.equal(manager.rawState(ROOM), undefined);

  const second = uploaded(manager.uploadPauseFile(bob, BOB_DEVICE));
  assert.equal(second.ready, true);
  assert.equal(second.error, null);
});

test('a file goes to its paused game on the server', () => {
  const { original, bob } = pauseFiles();
  assert.deepEqual(original.uploadPauseFile(bob, BOB_DEVICE), { error: 'Bob is already in this game' });
  original.disconnect(ROOM, 2);
  const wrongShare = { ...bob, share: original.rawState(ROOM)!.pause!.shares[1] };
  assert.deepEqual(original.uploadPauseFile(wrongShare, BOB_DEVICE), { error: MISMATCH });

  const oldKey = keyOf(original, 2);
  const upload = uploaded(original.uploadPauseFile(bob, BOB_DEVICE));
  assert.equal(upload.ready, true);
  assert.equal(upload.seat, 2);
  assert.notEqual(upload.seatKey, oldKey);
  assert.deepEqual(upload.players.map(player => player.ready), [true, true]);
  assert.equal(original.rawState(ROOM)?.seatDevices?.[2], hashDeviceId(BOB_DEVICE));
  assert.ok('error' in original.join('test', 'g1', 'Bob', true, oldKey));
  rejoined(original, 'Bob', upload.seatKey);

  // an undo past the pause keeps the key the file gave
  ok(original.resumeGame(ROOM, 1));
  ok(original.requestUndo(ROOM, 1));
  ok(original.voteUndo(ROOM, 2, true));
  original.disconnect(ROOM, 2);
  rejoined(original, 'Bob', upload.seatKey);
});

test('a file from another game is refused', () => {
  const { alice } = pauseFiles();
  assert.deepEqual(started().uploadPauseFile(alice, DEVICE), { error: ANOTHER_GAME });
  const other = paused(started());
  other.disconnect(ROOM, 1);
  assert.deepEqual(other.uploadPauseFile(alice, DEVICE), { error: ANOTHER_GAME });

  const { manager } = managerFor();
  const first = uploaded(manager.uploadPauseFile(alice, DEVICE));
  assert.deepEqual(manager.uploadPauseFile(fileOf(other, 2, keyOf(other, 2)), BOB_DEVICE), { error: ANOTHER_GAME });
  assert.deepEqual(statusOf(manager, first.seatKey).players.map(player => player.ready), [true, false]);
});

test('the same seat twice is refused', () => {
  const { alice } = pauseFiles();
  const { manager } = managerFor();
  uploaded(manager.uploadPauseFile(alice, DEVICE));
  assert.deepEqual(manager.uploadPauseFile(alice, DEVICE), { error: "Alice's file is already in" });
});

test('hostile uploads are refused before they are stored', () => {
  const { alice, bob } = pauseFiles();
  const { manager } = managerFor();
  const extraSeat = { ...alice, players: { ...alice.players, 3: 'Eve' } };
  for (const file of [undefined, 'text', [], extraSeat, { ...alice, gameId: ' g1' }]) {
    assert.deepEqual(manager.uploadPauseFile(file, DEVICE), { error: 'This file is not a pause file' });
  }
  const unknown = manager.uploadPauseFile({ ...alice, gameType: 'nope' }, DEVICE);
  assert.deepEqual(unknown, { error: 'This pause file is for a game this site does not have' });

  const first = uploaded(manager.uploadPauseFile(alice, { long: 'not a device' }));
  const renamed = { ...bob, players: { 1: 'Alice', 2: 'Bobby' }, playerName: 'Bobby' };
  assert.deepEqual(manager.uploadPauseFile(renamed, BOB_DEVICE), { error: "Bobby's pause file does not match the others" });
  for (const credential of [undefined, 42, 'wrong', alice.share, keyOf(pauseFiles().original, 1)]) {
    assert.deepEqual(manager.resumeStatus('test', 'g1', credential), { error: NOT_AVAILABLE });
  }
  assert.deepEqual(manager.resumeStatus('nope', 'g1', first.seatKey), { error: NOT_AVAILABLE });
  uploaded(manager.uploadPauseFile(bob, BOB_DEVICE));
  assert.equal(manager.rawState(ROOM)?.seatDevices?.[1], undefined);
});

test('joining a game waiting for files is refused', () => {
  const { alice } = pauseFiles();
  const { manager } = managerFor();
  uploaded(manager.uploadPauseFile(alice, DEVICE));
  assert.deepEqual(manager.join('test', 'g1', 'Cara'), { error: WAITING });
  assert.deepEqual(manager.join('test', 'g1', 'Alice', true), { error: WAITING });
  assert.deepEqual(manager.join('test', 'g1', 'Dana', undefined, undefined, 'spectator'), { error: WAITING });
  assert.deepEqual(manager.joinLocal('test', 'g1', ['Cara', 'Dan']), { error: WAITING });
});

test('a lobby nobody touches is forgotten', (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { alice } = pauseFiles();
  const { manager } = managerFor();
  const first = uploaded(manager.uploadPauseFile(alice, DEVICE));
  t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS - 1);
  statusOf(manager, first.seatKey); // a status read keeps it
  t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS - 1);
  statusOf(manager, first.seatKey);
  t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS + 1);
  assert.deepEqual(manager.resumeStatus('test', 'g1', first.seatKey), { error: NOT_AVAILABLE });
  assert.ok(!('error' in manager.join('test', 'g1', 'Cara')));
});

test('a lobby kept polling is forgotten an hour after it opened', (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { alice } = pauseFiles();
  const { manager } = managerFor();
  const first = uploaded(manager.uploadPauseFile(alice, DEVICE));
  const polls = Math.floor(MAX_RESUME_LOBBY_MS / EMPTY_ROOM_TIMEOUT_MS);
  for (let poll = 0; poll < polls; poll++) {
    t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS - 1);
    statusOf(manager, first.seatKey);
  }
  t.mock.timers.tick(polls);
  assert.deepEqual(manager.resumeStatus('test', 'g1', first.seatKey), { error: NOT_AVAILABLE });
});

test('the files every lobby holds are capped, and freed when dropped or forgotten', (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { alice, bob } = pauseFiles();
  const busy = { error: 'The server is too busy to resume a game. Try again later' };
  const size = (file: PauseFile) => JSON.stringify(file).length;

  const small = managerFor(handGame, undefined, undefined, { maxResumeBytes: size(alice) + size(bob) - 1 }).manager;
  const first = uploaded(small.uploadPauseFile(alice, DEVICE));
  assert.deepEqual(small.uploadPauseFile(bob, BOB_DEVICE), busy);
  assert.deepEqual(statusOf(small, first.seatKey).players.map(player => player.ready), [true, false]);
  t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS + 1);
  uploaded(small.uploadPauseFile(bob, BOB_DEVICE)); // Alice's forgotten file no longer counts

  // a file a failed check drops no longer counts either
  const exact = managerFor(handGame, undefined, undefined, { maxResumeBytes: size(alice) + size(bob) }).manager;
  uploaded(exact.uploadPauseFile(alice, DEVICE));
  const tampered = { ...bob, hand: { hand: 'card1' } };
  assert.equal(size(tampered), size(bob));
  assert.deepEqual(exact.uploadPauseFile(tampered, BOB_DEVICE), { error: MISMATCH });
  assert.equal(uploaded(exact.uploadPauseFile(bob, BOB_DEVICE)).ready, true);
});

test('a share the lobby\'s seal does not know is refused before it is stored', () => {
  const { alice, bob } = pauseFiles();
  const { manager } = managerFor();
  assert.deepEqual(manager.uploadPauseFile({ ...alice, share: bob.share }, DEVICE), { error: "Alice's pause file does not match the others" });
  const first = uploaded(manager.uploadPauseFile(alice, DEVICE)); // the forged file took no seat
  const forged = { ...bob, share: alice.share, seal: { ...bob.seal, shareHashes: { ...bob.seal.shareHashes, 2: shareHash(alice.share) } } };
  assert.deepEqual(manager.uploadPauseFile({ ...bob, share: alice.share }, BOB_DEVICE), { error: MISMATCH });
  assert.deepEqual(manager.uploadPauseFile(forged, BOB_DEVICE), { error: MISMATCH });
  assert.deepEqual(statusOf(manager, first.seatKey).players.map(player => player.ready), [true, false]);
  assert.equal(uploaded(manager.uploadPauseFile(bob, BOB_DEVICE)).ready, true);
});

// Alice, Bob and Cara with Cara dismissed, then paused: only Alice and Bob hold files
function pausedAfterDismissal(): { original: Manager; alice: PauseFile; bob: PauseFile } {
  const { manager: original } = managerFor();
  original.join('test', 'g1', 'Alice', undefined, undefined, undefined, DEVICE);
  original.join('test', 'g1', 'Bob');
  original.join('test', 'g1', 'Cara');
  ok(original.move(ROOM, 1, tick));
  original.disconnect(ROOM, 3);
  ok(original.requestDismiss(ROOM, 1, 3));
  assert.deepEqual(ok(original.voteDismiss(ROOM, 2, true)).activePlayers, [1, 2]);
  paused(original);
  return { original, alice: fileOf(original, 1, keyOf(original, 1)), bob: fileOf(original, 2, keyOf(original, 2)) };
}

test('a game with a dismissed player resumes from the seated players\' files', () => {
  const { original, alice, bob } = pausedAfterDismissal();
  assert.deepEqual(alice.players, { 1: 'Alice', 2: 'Bob' });
  const { manager } = managerFor();
  const first = uploaded(manager.uploadPauseFile(alice, DEVICE));
  assert.deepEqual(first.players, [{ seat: 1, name: 'Alice', ready: true }, { seat: 2, name: 'Bob', ready: false }]);
  const second = uploaded(manager.uploadPauseFile(bob, BOB_DEVICE));
  assert.equal(second.ready, true);
  rejoined(manager, 'Alice', first.seatKey);
  rejoined(manager, 'Bob', second.seatKey);
  const state = ok(manager.resumeGame(ROOM, 1));
  assert.deepEqual(state.activePlayers, [1, 2]);
  assert.equal(state.currentPlayer, original.rawState(ROOM)?.currentPlayer);
});

test('a file from a game with a dismissed player goes to its paused game on the server', () => {
  const { original, bob } = pausedAfterDismissal();
  original.disconnect(ROOM, 2);
  const upload = uploaded(original.uploadPauseFile(bob, BOB_DEVICE));
  assert.equal(upload.ready, true);
  assert.deepEqual(upload.players.map(player => player.name), ['Alice', 'Bob']);
  rejoined(original, 'Bob', upload.seatKey);
  ok(original.resumeGame(ROOM, 1));
});
