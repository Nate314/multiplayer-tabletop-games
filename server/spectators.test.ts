import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from './games.ts';
import { rememberingKeys } from './testing.ts';
import { openGameStore } from './store.ts';
import type { GameStore } from './store.ts';
import { handGame, testGame, type HandState } from '../shared/testGame.ts';
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
  ok(manager.move(ROOM, 1, tick)); // a lobby spectator is dropped on leaving; a started game keeps the entry
  assert.deepEqual(manager.join('test', 'g1', 'Dana', true, undefined, 'spectator'), { error: 'Dana is already in this game' });
  manager.disconnectSpectator(ROOM, dana.spectatorId);
  assert.deepEqual(manager.join('test', 'g1', 'Dana', false, 'wrong', 'spectator'), { error: 'That name is taken in this game' });
  assert.equal(watcher(manager, 'Dana', true).spectatorId, dana.spectatorId);
  assert.deepEqual(manager.join('test', 'g1', 'Eli', true, undefined, 'spectator'), { error: 'You are not in this game' });
});

test('a spectator who leaves a lobby frees the name', () => {
  const manager = gameWith('Alice');
  const dana = watcher(manager, 'Dana');
  manager.disconnectSpectator(ROOM, dana.spectatorId);
  assert.deepEqual((manager.rawState(ROOM) as HandState).spectators, []);
  assert.equal(manager.getSpectatorState(ROOM, dana.spectatorId), undefined);
  assert.ok(watcher(manager, 'Dana').spectatorId);
  manager.disconnectSpectator(ROOM, watcher(manager, 'Eli').spectatorId);
  assert.ok(!('error' in manager.join('test', 'g1', 'Eli')));
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
  const key = manager.rawState(ROOM)?.seatKeys?.[1] as string;
  const text = JSON.stringify([manager.history('test', 'g1', key), manager.gameFile('test', 'g1', key, new Date(0))]);
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

test('a spectator with no stored key cannot be taken back', () => {
  const store = openGameStore(':memory:');
  const source = gameWith('Alice', 'Bob');
  watcher(source, 'Dana');
  ok(source.move(ROOM, 1, tick));
  const { spectatorKeys: _k, ...keyless } = source.rawState(ROOM) as HandState;
  store.save(ROOM, 'test', keyless as HandState);
  assert.deepEqual(newManager(store).join('test', 'g1', 'Dana', true, undefined, 'spectator'), {
    error: 'That name is taken in this game'
  });
});

test('a spectator never has an undo to offer', () => {
  const manager = gameWith('Alice', 'Bob');
  const dana = watcher(manager, 'Dana');
  ok(manager.move(ROOM, 1, tick));
  assert.equal((manager.getState(ROOM, 1) as BasePublicState).undoAvailable, true);
  assert.equal(manager.getSpectatorState(ROOM, dana.spectatorId)?.undoAvailable, false);
});

// Alice and Bob with a started game and Dana watching
function started() {
  const manager = gameWith('Alice', 'Bob');
  const dana = watcher(manager, 'Dana');
  ok(manager.move(ROOM, 1, tick));
  return { manager, dana: dana.spectatorId };
}

const danaView = (manager: Manager, id: string) => manager.getSpectatorState(ROOM, id) as BasePublicState;

test('asking waits for the game to start', () => {
  const manager = gameWith('Alice', 'Bob');
  const dana = watcher(manager, 'Dana');
  assert.deepEqual(manager.requestHand(ROOM, dana.spectatorId, 1), { error: 'Wait for the game to start' });
});

test('a player sees only requests for their own seat', () => {
  const { manager, dana } = started();
  const eli = watcher(manager, 'Eli').spectatorId;
  const status = (manager.getState(ROOM, 1) as BasePublicState).gameStatus;
  ok(manager.requestHand(ROOM, dana, 1));
  const request = { spectator: dana, seat: 1 };
  assert.deepEqual((manager.getState(ROOM, 1) as BasePublicState).handRequests, [request]);
  assert.deepEqual((manager.getState(ROOM, 2) as BasePublicState).handRequests, []);
  assert.deepEqual(danaView(manager, eli).handRequests, []);
  assert.deepEqual(danaView(manager, dana).handRequests, [request]);
  assert.equal((manager.getState(ROOM, 1) as BasePublicState).gameStatus, status);
});

test('allowing shows that hand for the rest of the game', () => {
  const { manager, dana } = started();
  ok(manager.requestHand(ROOM, dana, 1));
  ok(manager.answerHand(ROOM, 1, dana, true));
  ok(manager.move(ROOM, 2, tick));
  assert.deepEqual(danaView(manager, dana).seatViews, { 1: { hand: 'card1' } });
  assert.ok(!JSON.stringify(danaView(manager, dana)).includes('card2'));
});

test('a no can be asked again', () => {
  const { manager, dana } = started();
  ok(manager.requestHand(ROOM, dana, 1));
  assert.deepEqual(manager.requestHand(ROOM, dana, 1), { error: 'You already asked' });
  ok(manager.answerHand(ROOM, 1, dana, false));
  assert.deepEqual(danaView(manager, dana).seatViews, {});
  ok(manager.requestHand(ROOM, dana, 1));
});

test('no request is left open', () => {
  const left = started();
  ok(left.manager.requestHand(ROOM, left.dana, 1));
  left.manager.disconnectSpectator(ROOM, left.dana);
  assert.deepEqual((left.manager.getState(ROOM, 1) as BasePublicState).handRequests, []);

  const dismissed = gameWith('Alice', 'Bob', 'Cy');
  const dana = watcher(dismissed, 'Dana').spectatorId;
  ok(dismissed.move(ROOM, 1, tick));
  ok(dismissed.requestHand(ROOM, dana, 1));
  dismissed.disconnect(ROOM, 1);
  ok(dismissed.requestDismiss(ROOM, 2, 1));
  ok(dismissed.voteDismiss(ROOM, 3, true));
  assert.deepEqual(danaView(dismissed, dana).handRequests, []);

  const over = started();
  ok(over.manager.requestHand(ROOM, over.dana, 1));
  ok(over.manager.move(ROOM, 2, tick));
  ok(over.manager.move(ROOM, 1, tick));
  assert.deepEqual(danaView(over.manager, over.dana).handRequests, []);
  assert.deepEqual(over.manager.requestHand(ROOM, over.dana, 2), { error: 'The game is over' });
});

test('a request does not survive a restart but the permission does', () => {
  const store = openGameStore(':memory:');
  const keys = new Map<string, string>();
  const manager = newManager(store, keys);
  manager.join('test', 'g1', 'Alice');
  manager.join('test', 'g1', 'Bob');
  const dana = watcher(manager, 'Dana').spectatorId;
  ok(manager.move(ROOM, 1, tick));
  ok(manager.requestHand(ROOM, dana, 1));
  ok(manager.answerHand(ROOM, 1, dana, true));
  ok(manager.requestHand(ROOM, dana, 2));
  const restarted = newManager(store, keys);
  assert.deepEqual((restarted.rawState(ROOM) as HandState).handRequests, []);
  assert.deepEqual(watcher(restarted, 'Dana', true).state.seatViews, { 1: { hand: 'card1' } });
});

test('answers and requests check who sends them', () => {
  const { manager, dana } = started();
  ok(manager.requestHand(ROOM, dana, 1));
  assert.deepEqual(manager.answerHand(ROOM, 2, dana, true), { error: 'No request to answer' });
  assert.deepEqual(manager.requestHand(ROOM, dana, 3), { error: 'That player is not in this game' });

  const plain = createGameManager([testGame], seededRandom);
  plain.join('test', 'g1', 'Alice');
  plain.join('test', 'g1', 'Bob');
  const eli = plain.join('test', 'g1', 'Eli', false, undefined, 'spectator');
  assert.ok('spectatorId' in eli && eli.spectatorId);
  assert.deepEqual(plain.requestHand(ROOM, eli.spectatorId, 1), { error: 'Nothing is hidden in this game' });
});

test('a spectator reacts to any player under its own name and cooldown', () => {
  const manager = gameWith('Alice', 'Bob');
  const dana = watcher(manager, 'Dana');
  const sender = { spectatorId: dana.spectatorId };
  assert.deepEqual(manager.react(ROOM, sender, 1, '😂'), { error: 'Reactions open once the game starts' });
  ok(manager.move(ROOM, 1, tick));
  const sent = manager.react(ROOM, sender, 1, '😂');
  assert.ok('reaction' in sent);
  assert.deepEqual({ ...sent.reaction, at: 0 }, { from: 'Dana', fromSpectator: true, target: 1, emoji: '😂', at: 0 });
  assert.match((manager.react(ROOM, sender, 2, '👍') as { error: string }).error, /^You can react again in/);
  assert.ok('reaction' in manager.react(ROOM, 1, 2, '👍')); // a player's cooldown is separate
  assert.deepEqual(manager.react(ROOM, { spectatorId: 'nobody' }, 1, '😂'), { error: 'You are not in this game' });
});

test("a spectator's file shows only the seats they were allowed, and their history is a player's", () => {
  const manager = gameWith('Alice', 'Bob');
  const dana = watcher(manager, 'Dana');
  const erin = watcher(manager, 'Erin');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.requestHand(ROOM, dana.spectatorId, 2));
  ok(manager.answerHand(ROOM, 2, dana.spectatorId, true));
  ok(manager.move(ROOM, 2, tick));
  ok(manager.move(ROOM, 1, tick));
  const player = manager.rawState(ROOM)?.seatKeys?.[1] as string;
  const fileFor = (key: string) => {
    const result = manager.gameFile('test', 'g1', key, new Date(0));
    if (!('file' in result)) assert.fail(result.error);
    return result.file;
  };
  for (const step of fileFor(dana.seatKey).steps) assert.deepEqual(Object.keys(step.views ?? {}), ['2']);
  for (const step of fileFor(erin.seatKey).steps) assert.deepEqual(step.views, {});
  assert.deepEqual(manager.history('test', 'g1', dana.seatKey), manager.history('test', 'g1', player));
  const text = JSON.stringify([manager.history('test', 'g1', dana.seatKey), fileFor(dana.seatKey), fileFor(player)]);
  for (const secret of [player, dana.seatKey, erin.seatKey, 'seatDevices']) assert.ok(!text.includes(secret), secret);
});
