import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager, EMPTY_ROOM_TIMEOUT_MS } from './games.ts';
import { rememberingKeys } from './testing.ts';
import type { GameStore, SavedRoom } from './store.ts';
import { testGame, type TestPublicState, type TestState } from '../shared/testGame.ts';
import { nextActivePlayer } from '../shared/seating.ts';
import type { BaseGameState, HistoryStep, Random, Result, Seat } from '../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const tick = { type: 'tick' };
const ROOM = 'test/g1';
const keys = new Map<string, string>(); // seat keys, kept across a restart

// Deterministic stand-in for Math.random
const seededRandom: Random = () => 0.5;

function newManager(): Manager {
  return rememberingKeys(createGameManager([testGame], seededRandom), keys);
}

function gameWith(...names: string[]): Manager {
  const manager = newManager();
  for (const name of names) manager.join('test', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to the test game's
function ok(result: Result<unknown>): TestPublicState {
  if ('error' in result) assert.fail(result.error);
  return result.state as TestPublicState;
}

function joined(result: ReturnType<Manager['join']>) {
  if ('error' in result) assert.fail(result.error);
  return result;
}

function left(result: ReturnType<Manager['disconnect']>): TestPublicState {
  assert.ok(result, 'expected the game to still exist');
  return result.state as TestPublicState;
}

function current(manager: Manager): TestPublicState {
  const state = manager.getState(ROOM);
  assert.ok(state, 'expected the game to exist');
  return state as TestPublicState;
}

// Two players take turns until player 1 makes the third tick and wins
function wonGame(): Manager {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  ok(manager.move(ROOM, 1, tick));
  return manager;
}

test('join trims the game ID and name and rejects blanks', () => {
  const manager = newManager();
  const first = joined(manager.join('test', '  g1 ', ' Alice '));
  assert.equal(first.roomId, ROOM);
  assert.equal(first.state.gameId, 'g1');
  assert.equal(first.seat, 1);
  assert.equal(first.state.playerNames[1], 'Alice');
  assert.equal(joined(manager.join('test', 'g1', 'Bob')).seat, 2);
  assert.deepEqual(manager.join('test', '   ', 'X'), { error: 'Please enter a game ID' });
  assert.deepEqual(manager.join('test', 'g1', '   '), { error: 'Please enter your name' });
  assert.deepEqual(manager.join('test', null, undefined), { error: 'Please enter a game ID' });
});

test('names and game IDs are cut to 20 characters', () => {
  const result = joined(newManager().join('test', 'x'.repeat(30), 'y'.repeat(30)));
  assert.equal(result.state.gameId, 'x'.repeat(20));
  assert.equal(result.roomId, `test/${'x'.repeat(20)}`);
  assert.equal(result.state.playerNames[1], 'y'.repeat(20));
});

test('an unknown or missing game type is refused', () => {
  const manager = newManager();
  assert.deepEqual(manager.join('chess', 'g', 'A'), { error: 'Unknown game' });
  assert.deepEqual(manager.join(undefined, 'g', 'A'), { error: 'Unknown game' });
});

test('the same game ID in two game types is two rooms', () => {
  const copy = { ...testGame, info: { ...testGame.info, id: 'test2' } };
  const manager = rememberingKeys(createGameManager([testGame, copy], seededRandom), keys);
  const first = joined(manager.join('test', 'friday', 'A'));
  const second = joined(manager.join('test2', 'friday', 'B'));
  assert.equal(first.seat, 1);
  assert.equal(second.seat, 1);
  assert.notEqual(first.roomId, second.roomId);
});

test('join is refused at four players and after the first move', () => {
  assert.deepEqual(gameWith('A', 'B', 'C', 'D').join('test', 'g1', 'E'), { error: 'Game is full' });

  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  assert.deepEqual(manager.join('test', 'g1', 'C'), { error: 'Game already in progress' });
});

test('browsers never receive hidden fields', () => {
  const manager = newManager();
  const first = joined(manager.join('test', 'g1', 'A'));
  const second = joined(manager.join('test', 'g1', 'B'));
  const afterMove = ok(manager.move(ROOM, 1, tick));
  const afterLeave = left(gameWith('A', 'B', 'C').disconnect(ROOM, 3));
  for (const state of [first.state, second.state, afterMove, afterLeave, current(manager)]) {
    assert.equal('secret' in state, false);
  }
});

test('moves are validated and recorded for undo', () => {
  const manager = gameWith('A', 'B');
  assert.equal(current(manager).undoAvailable, false);
  assert.deepEqual(manager.move('test/nope', 1, tick), { error: 'Game not found' });
  assert.deepEqual(manager.move(ROOM, 3, tick), { error: 'You are not in this game' });
  assert.deepEqual(manager.move(ROOM, 2, tick), { error: 'Not your turn' });
  assert.deepEqual(manager.move(ROOM, 1, { nonsense: true }), { error: 'Invalid move' });
  assert.deepEqual(manager.move(ROOM, 1, null), { error: 'Invalid move' });

  const state = ok(manager.move(ROOM, 1, tick));
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.started, true);
  assert.equal(state.moves, 1);
  assert.equal(state.undoAvailable, true);
  assert.deepEqual(manager.getState(ROOM, 1), state);
});

test('disconnecting in the lobby frees the seat and the last one out deletes the game', () => {
  const manager = gameWith('A', 'B');
  assert.deepEqual(left(manager.disconnect(ROOM, 1)).activePlayers, [2]);
  assert.equal(joined(manager.join('test', 'g1', 'C')).seat, 1);
  manager.disconnect(ROOM, 1);
  assert.equal(manager.disconnect(ROOM, 2), null);
  assert.equal(manager.getState(ROOM), undefined);
  assert.equal(manager.disconnect(ROOM, 2), null);
});

test('disconnecting mid-game holds the seat', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  const state = left(manager.disconnect(ROOM, 2));
  assert.deepEqual(state.activePlayers, [1, 2]);
  assert.deepEqual(state.disconnected, [2]);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.isGameOver, false);
  assert.equal(state.gameStatus, 'B disconnected');
  assert.deepEqual(manager.move(ROOM, 1, tick), { error: 'Not your turn' });
});

test('dismissing the last opponent hands the win to the player left', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 2);
  const state = ok(manager.requestDismiss(ROOM, 1, 2));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.deepEqual(state.activePlayers, [1]);
  assert.deepEqual(manager.move(ROOM, 1, tick), { error: 'The game is over' });
});

test('an undo approved by everyone restores the previous turn', () => {
  const manager = gameWith('A', 'B', 'C');
  assert.deepEqual(manager.requestUndo(ROOM, 1), { error: 'Nothing to undo' });
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));

  const requested = ok(manager.requestUndo(ROOM, 3));
  assert.deepEqual(requested.undoVote, { requestedBy: 3, votes: { 3: true } });
  assert.equal(requested.gameStatus, 'C wants to undo the last turn');

  const partial = ok(manager.voteUndo(ROOM, 1, true));
  assert.equal(partial.moves, 2);

  const restored = ok(manager.voteUndo(ROOM, 2, true));
  assert.equal(restored.undoVote, null);
  assert.equal(restored.moves, 1);
  assert.equal(restored.currentPlayer, 2);
  assert.equal(restored.started, true); // joining stays closed
  assert.equal(restored.gameStatus, 'Last turn undone');

  // A late or duplicate approval must not undo a second turn
  assert.deepEqual(manager.voteUndo(ROOM, 3, true), { error: 'No undo vote in progress' });
  assert.equal(current(manager).moves, 1);
  assert.equal(current(manager).undoAvailable, true);
});

test('one decline cancels the vote', () => {
  const manager = gameWith('A', 'B', 'C');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  const declined = ok(manager.voteUndo(ROOM, 3, 'yes')); // anything but true is a decline
  assert.equal(declined.undoVote, null);
  assert.equal(declined.gameStatus, 'C declined the undo');
  assert.equal(declined.moves, 1);
  assert.equal(declined.currentPlayer, 2);
  assert.equal(declined.undoAvailable, true);
});

test('undo requests and votes are validated', () => {
  const manager = gameWith('A', 'B');
  assert.deepEqual(manager.requestUndo(ROOM, 1), { error: 'Nothing to undo' });
  ok(manager.move(ROOM, 1, tick));
  assert.deepEqual(manager.voteUndo(ROOM, 1, true), { error: 'No undo vote in progress' });
  ok(manager.requestUndo(ROOM, 1));
  assert.deepEqual(manager.requestUndo(ROOM, 2), { error: 'An undo vote is already in progress' });
  assert.deepEqual(manager.voteUndo(ROOM, 1, true), { error: 'You already voted' });
  assert.deepEqual(manager.move(ROOM, 2, tick), { error: 'An undo vote is in progress' });
});

test('a player disconnecting during a vote no longer counts', () => {
  const manager = gameWith('A', 'B', 'C');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  const after = left(manager.disconnect(ROOM, 3));
  assert.equal(after.undoVote, null);
  assert.equal(after.moves, 0);
  assert.deepEqual(after.activePlayers, [1, 2, 3]);
  assert.deepEqual(after.disconnected, [3]);
  assert.equal(after.currentPlayer, 1);
  assert.equal(after.gameStatus, 'Last turn undone');
});

test('repeated undos step back to the start and the game stays locked', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  ok(manager.requestUndo(ROOM, 2));
  const start = ok(manager.voteUndo(ROOM, 1, true));
  assert.equal(start.moves, 0);
  assert.equal(start.currentPlayer, 1);
  assert.equal(start.started, true);
  assert.equal(start.undoAvailable, false);
  assert.deepEqual(manager.requestUndo(ROOM, 1), { error: 'Nothing to undo' });
  assert.deepEqual(manager.join('test', 'g1', 'C'), { error: 'Game already in progress' });
});

test('an undo returning the turn to a dismissed player skips them', () => {
  const manager = gameWith('A', 'B', 'C');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  manager.disconnect(ROOM, 2);
  ok(manager.requestDismiss(ROOM, 1, 2));
  ok(manager.voteDismiss(ROOM, 3, true));
  ok(manager.requestUndo(ROOM, 1));
  const restored = ok(manager.voteUndo(ROOM, 3, true));
  assert.equal(restored.currentPlayer, 3);
  assert.deepEqual(restored.activePlayers, [1, 3]);
  assert.equal(restored.playerNames[2], 'B');
  assert.equal(restored.moves, 1);
});

test('the winning move can be undone', () => {
  const manager = wonGame();
  assert.deepEqual(current(manager).winners, [1]);

  ok(manager.requestUndo(ROOM, 2));
  const restored = ok(manager.voteUndo(ROOM, 1, true));
  assert.equal(restored.isGameOver, false);
  assert.deepEqual(restored.winners, []);
  assert.equal(restored.moves, 2);
  assert.equal(restored.currentPlayer, 1);
});

test('an undo vote after a win is canceled when the winner disconnects', () => {
  const manager = wonGame();
  ok(manager.requestUndo(ROOM, 2));
  const state = left(manager.disconnect(ROOM, 1));
  assert.equal(state.undoVote, null);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.moves, 3);
  assert.equal(state.moveCount, 3);
  assert.deepEqual(state.disconnected, [1]);
  assert.deepEqual(manager.voteUndo(ROOM, 2, true), { error: 'No undo vote in progress' });
});

test('an undo vote is canceled when a disconnect leaves one connected player', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.requestUndo(ROOM, 1));
  const state = left(manager.disconnect(ROOM, 2));
  assert.equal(state.undoVote, null);
  assert.equal(state.moves, 1);
  assert.equal(state.moveCount, 1);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.gameStatus, 'B disconnected');
  assert.equal(manager.history('test', 'g1')?.length, 2);
});

test('an undo vote after a win is canceled when the requester disconnects', () => {
  const manager = wonGame();
  ok(manager.requestUndo(ROOM, 2));
  const state = left(manager.disconnect(ROOM, 2));
  assert.equal(state.undoVote, null);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
});

test('actions are not recorded for undo', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  const pinged = ok(manager.action(ROOM, 2, { type: 'ping' })); // not turn-bound
  assert.equal(pinged.gameStatus, 'B pinged');
  assert.deepEqual(manager.action(ROOM, 2, { type: 'nope' }), { error: 'Unknown action' });
  assert.deepEqual(manager.action(ROOM, 3, { type: 'ping' }), { error: 'You are not in this game' });

  ok(manager.requestUndo(ROOM, 1));
  const restored = ok(manager.voteUndo(ROOM, 2, true));
  assert.equal(restored.moves, 0);
  assert.equal(restored.currentPlayer, 1);
  assert.equal(restored.undoAvailable, false);
});

test('a game without actions refuses them', () => {
  const withoutActions = { ...testGame, applyAction: undefined };
  const manager = rememberingKeys(createGameManager([withoutActions], seededRandom), keys);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  assert.deepEqual(manager.action(ROOM, 1, { type: 'ping' }), { error: 'This game has no actions' });
});

// A, B and C in a started game: A has moved, so it is B's turn
function startedWith3(): Manager {
  const manager = gameWith('A', 'B', 'C');
  ok(manager.move(ROOM, 1, tick));
  return manager;
}

test('a disconnected player rejoins their seat by name', () => {
  const manager = startedWith3();
  manager.disconnect(ROOM, 1);
  const back = joined(manager.join('test', 'g1', ' a ', true));
  assert.equal(back.roomId, ROOM);
  assert.equal(back.seat, 1);
  assert.equal(back.state.playerNames[1], 'A');
  assert.equal(back.state.gameStatus, 'A is back');
  assert.deepEqual(back.state.disconnected, []);
  assert.equal(back.state.moveCount, 1);
});

test('a connected name cannot be taken', () => {
  const manager = startedWith3();
  assert.deepEqual(manager.join('test', 'g1', 'a'), { error: 'A is already in this game' });
  assert.deepEqual(manager.join('test', 'g1', 'A', true), { error: 'A is already in this game' });
  assert.deepEqual(gameWith('Bob').join('test', 'g1', 'BOB '), { error: 'Bob is already in this game' });
});

test('a held seat is taken back only with its key, which no view shows', () => {
  const manager = createGameManager([testGame], seededRandom);
  const alice = joined(manager.join('test', 'g1', 'A'));
  manager.join('test', 'g1', 'B');
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 1);
  assert.deepEqual(manager.join('test', 'g1', 'A', true), { error: 'That name is taken in this game' });
  assert.deepEqual(manager.join('test', 'g1', 'a', false, 'guess'), { error: 'That name is taken in this game' });
  const back = joined(manager.join('test', 'g1', 'A', true, alice.seatKey));
  assert.equal(back.seat, 1);
  assert.equal(back.seatKey, alice.seatKey);
  for (const view of [back.state, manager.getState(ROOM, 2), ...(manager.history('test', 'g1') ?? [])]) {
    assert.equal(JSON.stringify(view).includes(alice.seatKey), false);
  }
});

test('a dismissed player cannot rejoin', () => {
  const manager = startedWith3();
  manager.disconnect(ROOM, 3);
  ok(manager.requestDismiss(ROOM, 1, 3));
  ok(manager.voteDismiss(ROOM, 2, true));
  assert.deepEqual(manager.join('test', 'g1', 'C'), { error: 'You were removed from this game' });
  assert.deepEqual(manager.join('test', 'g1', 'c', true), { error: 'You were removed from this game' });
});

test('rejoin never creates a game', () => {
  const manager = newManager();
  assert.deepEqual(manager.join('test', 'nope', 'A', true), { error: 'Game not found' });
  assert.equal(manager.getState('test/nope'), undefined);
  assert.deepEqual(gameWith('A').join('test', 'g1', 'B', true), { error: 'You are not in this game' });
  assert.deepEqual(startedWith3().join('test', 'g1', 'D', true), { error: 'You are not in this game' });
  assert.deepEqual(startedWith3().join('test', 'g1', 'D'), { error: 'Game already in progress' });
});

// A started game whose players have all disconnected
function everyoneGone(): Manager {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 1);
  manager.disconnect(ROOM, 2);
  return manager;
}

test('an empty started game survives ten minutes', (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const manager = everyoneGone();
  manager.disconnect(ROOM, 2); // a repeat does not restart the countdown
  t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS - 1);
  assert.deepEqual(current(manager).disconnected, [1, 2]);
  assert.equal(joined(manager.join('test', 'g1', 'B', true)).seat, 2);

  // The rejoin canceled the countdown, and the next empty spell starts a new one
  t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS);
  assert.ok(manager.getState(ROOM));
  manager.disconnect(ROOM, 2);
  t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS - 1);
  assert.ok(manager.getState(ROOM));
  t.mock.timers.tick(1);
  assert.equal(manager.getState(ROOM), undefined);
});

test('an empty started game is deleted after ten minutes', (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const manager = everyoneGone();
  t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS);
  assert.equal(manager.getState(ROOM), undefined);
  assert.deepEqual(manager.join('test', 'g1', 'A', true), { error: 'Game not found' });
  assert.equal(manager.history('test', 'g1'), null);
});

test('undo counts only connected players', () => {
  const manager = startedWith3();
  manager.disconnect(ROOM, 3);
  ok(manager.requestUndo(ROOM, 1));
  const restored = ok(manager.voteUndo(ROOM, 2, true));
  assert.equal(restored.moves, 0);
  assert.equal(restored.moveCount, 0);
  assert.deepEqual(restored.disconnected, [3]);
  assert.deepEqual(restored.activePlayers, [1, 2, 3]);
});

test('undo needs two connected players', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 1);
  assert.deepEqual(manager.requestUndo(ROOM, 2), { error: 'Not enough players to vote' });
});

test("undo back to a disconnected player's turn waits on them", () => {
  const manager = startedWith3();
  ok(manager.move(ROOM, 2, tick)); // C to move
  manager.disconnect(ROOM, 2);
  ok(manager.requestUndo(ROOM, 3));
  const restored = ok(manager.voteUndo(ROOM, 1, true));
  assert.equal(restored.currentPlayer, 2);
  assert.deepEqual(restored.disconnected, [2]);
  assert.equal(restored.moves, 1);
  assert.deepEqual(manager.move(ROOM, 3, tick), { error: 'Not your turn' });
});

test('the undo requester disconnecting cancels the vote, and rejoining leaves no vote', () => {
  const manager = startedWith3();
  ok(manager.requestUndo(ROOM, 1));
  assert.equal(left(manager.disconnect(ROOM, 1)).undoVote, null);
  const back = joined(manager.join('test', 'g1', 'A', true));
  assert.equal(back.state.undoVote, null);
  assert.deepEqual(manager.voteUndo(ROOM, 2, true), { error: 'No undo vote in progress' });
  assert.equal(current(manager).moves, 1);
});

test('dismiss vote: target must be disconnected; one at a time; decline cancels; approval removes', () => {
  const manager = startedWith3();
  assert.deepEqual(manager.requestDismiss(ROOM, 1, 3), { error: 'That player is not disconnected' });
  assert.deepEqual(manager.requestDismiss(ROOM, 1, 9), { error: 'That player is not disconnected' });
  assert.deepEqual(manager.requestDismiss(ROOM, 1, '3'), { error: 'That player is not disconnected' });
  assert.deepEqual(manager.voteDismiss(ROOM, 1, true), { error: 'No dismiss vote in progress' });

  manager.disconnect(ROOM, 3);
  ok(manager.requestUndo(ROOM, 1));
  assert.deepEqual(manager.requestDismiss(ROOM, 2, 3), { error: 'A vote is already in progress' });
  ok(manager.voteUndo(ROOM, 2, false));

  const requested = ok(manager.requestDismiss(ROOM, 1, 3));
  assert.deepEqual(requested.dismissVote, { target: 3, requestedBy: 1, votes: { 1: true } });
  assert.equal(requested.gameStatus, 'A wants to dismiss C');
  assert.deepEqual(manager.requestDismiss(ROOM, 2, 3), { error: 'A vote is already in progress' });
  assert.deepEqual(manager.requestUndo(ROOM, 2), { error: 'A dismiss vote is in progress' });
  assert.deepEqual(manager.voteDismiss(ROOM, 1, true), { error: 'You already voted' });
  assert.deepEqual(manager.move(ROOM, 2, tick), { error: 'A dismiss vote is in progress' });

  const declined = ok(manager.voteDismiss(ROOM, 2, 'yes')); // anything but true is a decline
  assert.equal(declined.dismissVote, null);
  assert.equal(declined.gameStatus, 'B declined to dismiss C');
  assert.deepEqual(declined.activePlayers, [1, 2, 3]);

  ok(manager.requestDismiss(ROOM, 2, 3));
  const dismissed = ok(manager.voteDismiss(ROOM, 1, true));
  assert.equal(dismissed.dismissVote, null);
  assert.deepEqual(dismissed.activePlayers, [1, 2]);
  assert.deepEqual(dismissed.disconnected, []);
  assert.equal(dismissed.gameStatus, 'C was dismissed');
  assert.equal(dismissed.playerNames[3], 'C');
});

test('a dismiss vote ends when its target rejoins', () => {
  const manager = startedWith3();
  manager.disconnect(ROOM, 3);
  ok(manager.requestDismiss(ROOM, 1, 3));
  const back = joined(manager.join('test', 'g1', 'C', true));
  assert.equal(back.state.dismissVote, null);
  assert.deepEqual(manager.voteDismiss(ROOM, 2, true), { error: 'No dismiss vote in progress' });
});

test('history starts at the starting board, lists each move, hides secrets, and drops undone moves', () => {
  const manager = gameWith('A', 'B', 'C');
  const before = manager.history('test', 'g1') as (TestPublicState & HistoryStep)[];
  assert.deepEqual(before.map(step => step.historyStep), ['start']);
  assert.equal(before[0].moveCount, 0);
  assert.equal(before[0].moves, 0);
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  const last = ok(manager.move(ROOM, 3, tick));
  assert.equal(last.moveCount, 3);

  const steps = manager.history('test', ' g1 ') as (TestPublicState & HistoryStep)[] | null;
  assert.ok(steps);
  assert.deepEqual(steps.map(step => step.historyStep), ['start', 'move', 'move', 'move']);
  assert.deepEqual(steps.map(step => step.moveCount), [0, 1, 2, 3]);
  assert.deepEqual(steps.map(step => step.moves), [0, 1, 2, 3]);
  for (const step of steps) {
    assert.equal('secret' in step, false);
    assert.equal(step.undoAvailable, false);
    assert.equal(step.viewer, null);
  }

  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  const undone = ok(manager.voteUndo(ROOM, 3, true));
  assert.equal(undone.moveCount, 2);
  assert.equal(manager.history('test', 'g1')?.length, 3);

  assert.equal(manager.history('chess', 'g1'), null);
  assert.equal(manager.history('test', 'nope'), null);
  assert.equal(manager.history('test', 'a/b'), null);
  assert.equal(manager.history(undefined, undefined), null);
});

test('each view is built for the seat it is sent to', () => {
  const manager = gameWith('A', 'B');
  assert.equal(ok(manager.move(ROOM, 1, tick)).viewer, 1);
  assert.equal(ok(manager.move(ROOM, 2, tick)).viewer, 2);
  assert.equal(current(manager).viewer, null);
  assert.equal((manager.getState(ROOM, 2) as TestPublicState).viewer, 2);
  left(manager.disconnect(ROOM, 2));
  assert.equal((joined(manager.join('test', 'g1', 'b')).state as TestPublicState).viewer, 2);
});

test('actions add no history steps', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  const pinged = ok(manager.action(ROOM, 2, { type: 'ping' }));
  assert.equal(pinged.moveCount, 1);
  assert.equal(manager.history('test', 'g1')?.length, 2);
});

test('the start step is the board before the first move, also after undoing back to zero', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  const [start] = manager.history('test', 'g1') as unknown as TestPublicState[];
  assert.equal(start.moves, 0);
  assert.deepEqual(start.playerNames, { 1: 'A', 2: 'B' });
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  const steps = manager.history('test', 'g1') as HistoryStep[];
  assert.deepEqual(steps.map(step => step.historyStep), ['start']);
});

test('a game that ends outside a move gets an end step built from the live state', () => {
  const manager = gameWith('A', 'B', 'C');
  ok(manager.move(ROOM, 1, tick));
  left(manager.disconnect(ROOM, 2));
  left(manager.disconnect(ROOM, 3));
  ok(manager.requestDismiss(ROOM, 1, 2));
  ok(manager.requestDismiss(ROOM, 1, 3));
  const steps = manager.history('test', 'g1') as HistoryStep[];
  assert.deepEqual(steps.map(step => step.historyStep), ['start', 'move', 'end']);
  const end = steps[2];
  assert.equal(end.isGameOver, true);
  assert.equal(end.moveCount, 1);
  assert.equal(end.gameStatus, 'A wins! Everyone else left.');
  assert.equal('secret' in end, false);
});

test('a game ended by an action gets an end step, and an undo removes it', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  assert.deepEqual((manager.history('test', 'g1') as HistoryStep[]).map(s => s.historyStep), ['start', 'move']);
  ok(manager.action(ROOM, 2, { type: 'concede' }));
  assert.deepEqual((manager.history('test', 'g1') as HistoryStep[]).map(s => s.historyStep), ['start', 'move', 'end']);
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  assert.deepEqual((manager.history('test', 'g1') as HistoryStep[]).map(s => s.historyStep), ['start']);
});

test('a game won by a move has no end step', () => {
  const steps = wonGame().history('test', 'g1') as HistoryStep[];
  assert.deepEqual(steps.map(s => s.historyStep), ['start', 'move', 'move', 'move']);
});

test('gameFile refuses until the game is over', () => {
  const now = new Date('2026-10-18T20:15:00.000Z');
  assert.deepEqual(gameWith('A', 'B').gameFile('test', 'g1', now), { error: 'The game is not over yet' });
  assert.equal(gameWith('A', 'B').gameFile('test', 'nope', now), null);
  assert.equal(newManager().gameFile('chess', 'g1', now), null);
});

test('gameFile gives every step a table view and a view per seat', () => {
  const result = wonGame().gameFile('test', 'g1', new Date('2026-10-18T20:15:00.000Z'));
  assert.ok(result && 'file' in result);
  const { file } = result;
  assert.equal(file.version, 2);
  assert.equal(file.gameType, 'test');
  assert.equal(file.gameId, 'g1');
  assert.equal(file.exportedAt, '2026-10-18T20:15:00.000Z');
  assert.equal(file.steps.length, 4);
  for (const step of file.steps) {
    assert.equal((step as unknown as TestPublicState).viewer, null);
    assert.equal('secret' in step, false);
    const views = step.views as Record<string, HistoryStep & TestPublicState>;
    assert.deepEqual(Object.keys(views), ['1', '2']);
    assert.equal(views['2'].viewer, 2);
    for (const view of Object.values(views)) assert.equal('secret' in view, false);
    assert.equal(views['1'].moveCount, step.moveCount);
    assert.equal(views['1'].historyStep, step.historyStep);
  }
});

test('gameFile gives the end step views when the game ended by an action', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.action(ROOM, 2, { type: 'concede' }));
  const result = manager.gameFile('test', 'g1', new Date());
  assert.ok(result && 'file' in result);
  const last = result.file.steps.at(-1);
  assert.equal(last?.historyStep, 'end');
  assert.equal(last?.views?.['1'].isGameOver, true);
});

// A store over Maps laid out like the database's two tables; copies on save and load, as the database does,
// so shared references fail the tests. `written` counts the states each save wrote
type MemoryStore = GameStore & { written: number[] };

function memoryStore(): MemoryStore {
  const rooms = new Map<string, { gameType: string; state: BaseGameState }>();
  const steps = new Map<string, { before: BaseGameState; after: BaseGameState }[]>();
  const written: number[] = [];
  return {
    written,
    loadAll: () => new Map([...rooms].map(([roomId, { gameType, state }]) => {
      const roomSteps = steps.get(roomId) ?? [];
      const history = roomSteps.map(step => step.before);
      const timeline = roomSteps.map(step => step.after);
      return [roomId, structuredClone({ gameType, state, history, timeline })];
    })),
    save: (roomId, gameType, state, step) => {
      rooms.set(roomId, structuredClone({ gameType, state }));
      const roomSteps = steps.get(roomId) ?? [];
      if (step?.type === 'push') roomSteps[step.index] = structuredClone({ before: step.before, after: step.after });
      if (step?.type === 'pop') roomSteps.length = step.index;
      steps.set(roomId, roomSteps);
      written.push(step?.type === 'push' ? 3 : 1);
    },
    remove: roomId => { rooms.delete(roomId); steps.delete(roomId); }
  };
}

// A new manager over the same store, as after a server restart
function restart(store: GameStore): Manager {
  return rememberingKeys(createGameManager([testGame], seededRandom, store), keys);
}

function saved(store: GameStore): SavedRoom {
  const room = store.loadAll().get(ROOM);
  assert.ok(room, 'expected the game to be saved');
  return room;
}

test('a started game is saved after each change and a lobby is not', () => {
  const store = memoryStore();
  const manager = restart(store);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  assert.equal(store.loadAll().size, 0);

  ok(manager.move(ROOM, 1, tick));
  assert.equal(saved(store).timeline.length, 1);
  ok(manager.action(ROOM, 1, { type: 'ping' }));
  assert.equal(saved(store).state.gameStatus, 'A pinged');
});

test('a save late in a long game writes one step, not the whole history', () => {
  // Never ends, so the game can run long
  const endless = {
    ...testGame,
    applyMove: (state: TestState, seat: Seat) =>
      ({ state: { ...state, moves: state.moves + 1, currentPlayer: nextActivePlayer(state, seat) } })
  };
  const store = memoryStore();
  const manager = rememberingKeys(createGameManager([endless], seededRandom, store), keys);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  for (let move = 0; move < 50; move++) ok(manager.move(ROOM, (move % 2) + 1, tick));

  assert.equal(saved(store).timeline.length, 50);
  assert.equal(store.written.at(-1), 3); // the live state, and the one step's before and after
  assert.ok(store.written.every(count => count <= 3));
});

test('an approved undo removes the last saved step', () => {
  const store = memoryStore();
  const manager = restart(store);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  assert.equal(saved(store).timeline.length, 1);
  assert.equal(saved(store).history.length, 1);
  assert.equal(saved(store).state.gameStatus, 'Last turn undone');
  assert.equal(restart(store).history('test', 'g1')?.length, 2);
});

test('a dismiss vote, a disconnect and a rejoin are saved', () => {
  const store = memoryStore();
  const manager = restart(store);
  for (const name of ['A', 'B', 'C']) manager.join('test', 'g1', name);
  ok(manager.move(ROOM, 1, tick));

  manager.disconnect(ROOM, 3);
  assert.deepEqual(saved(store).state.disconnected, [3]);
  manager.disconnect(ROOM, 2);
  assert.deepEqual(saved(store).state.disconnected, [2, 3]);
  joined(manager.join('test', 'g1', 'B', true));
  assert.deepEqual(saved(store).state.disconnected, [3]);

  ok(manager.requestDismiss(ROOM, 1, 3));
  ok(manager.voteDismiss(ROOM, 2, true));
  assert.deepEqual(saved(store).state.activePlayers, [1, 2]);
  assert.equal(saved(store).state.dismissVote, null);
});

test('a restart keeps the game and holds every seat', () => {
  const store = memoryStore();
  const manager = restart(store);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  ok(manager.move(ROOM, 1, tick));

  const restarted = restart(store);
  assert.deepEqual(current(restarted).disconnected, [1, 2]);
  assert.equal(current(restarted).moveCount, 1);
  assert.equal(joined(restarted.join('test', 'g1', 'A', true)).seat, 1);
  assert.equal(restarted.history('test', 'g1')?.length, 2);
});

test('a restart clears open votes and dismisses nobody', () => {
  const store = memoryStore();
  const manager = restart(store);
  for (const name of ['A', 'B', 'C']) manager.join('test', 'g1', name);
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 3);
  ok(manager.requestDismiss(ROOM, 1, 3));
  assert.ok(saved(store).state.dismissVote);

  const restarted = restart(store);
  assert.deepEqual(current(restarted).activePlayers, [1, 2, 3]);
  assert.equal(current(restarted).dismissVote, null);
  assert.equal(current(restarted).undoVote, null);
});

test('a restart clears an open undo vote', () => {
  const store = memoryStore();
  const manager = restart(store);
  for (const name of ['A', 'B', 'C']) manager.join('test', 'g1', name);
  ok(manager.move(ROOM, 1, tick));
  ok(manager.requestUndo(ROOM, 2));
  assert.ok(saved(store).state.undoVote);

  const restarted = restart(store);
  assert.equal(current(restarted).undoVote, null);
  assert.equal(current(restarted).moveCount, 1);
});

test('after a restart the empty game is deleted after the timeout, from the store too', (t: TestContext) => {
  const store = memoryStore();
  const manager = restart(store);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  ok(manager.move(ROOM, 1, tick));

  t.mock.timers.enable({ apis: ['setTimeout'] });
  const restarted = restart(store);
  t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS - 1);
  assert.ok(restarted.getState(ROOM));
  t.mock.timers.tick(1);
  assert.equal(restarted.getState(ROOM), undefined);
  assert.equal(store.loadAll().has(ROOM), false);
});

test('a saved game whose type no longer exists is dropped', (t: TestContext) => {
  const logged = t.mock.method(console, 'error', () => {});
  const store = memoryStore();
  const state = { ...testGame.createGameState('g1'), started: true };
  store.save('chess/g1', 'chess', state);
  restart(store);
  assert.equal(store.loadAll().has('chess/g1'), false);
  assert.equal(logged.mock.callCount(), 1);
});

test('a saved game that fails to load is dropped and the others still load', (t: TestContext) => {
  const logged = t.mock.method(console, 'error', () => {});
  const store = memoryStore();
  const manager = restart(store);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  ok(manager.move(ROOM, 1, tick));
  const { activePlayers: _activePlayers, ...broken } = { ...testGame.createGameState('g2'), started: true };
  store.save('test/g2', 'test', broken as unknown as BaseGameState);

  const restarted = restart(store);
  assert.equal(restarted.getState('test/g2'), undefined);
  assert.equal(store.loadAll().has('test/g2'), false);
  assert.equal(current(restarted).moveCount, 1);
  assert.equal(logged.mock.callCount(), 1);
});

test("loading holds every seat without running the game's disconnect hook", () => {
  const store = memoryStore();
  const manager = restart(store);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  ok(manager.move(ROOM, 1, tick));

  // Azul, Uno and Phase 10 deal the next round from this hook once nobody is waiting
  const withHook = { ...testGame, onPlayerDisconnected: (state: TestState) => ({ ...state, gameStatus: 'hook ran' }) };
  const restarted = rememberingKeys(createGameManager([withHook], seededRandom, store), keys);
  assert.deepEqual(current(restarted).disconnected, [1, 2]);
  assert.equal(current(restarted).gameStatus, 'A ticked');
  assert.equal(saved(store).state.gameStatus, 'A ticked');
});

test('a store that fails to save does not stop play', (t: TestContext) => {
  const logged = t.mock.method(console, 'error', () => {});
  const failing: GameStore = {
    ...memoryStore(),
    save: () => { throw new Error('disk full'); }
  };
  const manager = restart(failing);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  assert.equal(ok(manager.move(ROOM, 1, tick)).moves, 1);
  assert.equal(logged.mock.callCount(), 1);
});

test('deleting a room removes it from the store', (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const store = memoryStore();
  const manager = restart(store);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 1);
  manager.disconnect(ROOM, 2);
  assert.equal(store.loadAll().size, 1);
  t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS);
  assert.equal(store.loadAll().size, 0);
});

test('a started game plays on and can undo after dismissals take it below its minimum', () => {
  // Only the start needs the minimum; a game that cannot go on ends itself in onPlayerLeft, as Rook does
  const manager = rememberingKeys(createGameManager([{ ...testGame, info: { ...testGame.info, minPlayers: 3 } }], seededRandom), keys);
  for (const name of ['A', 'B', 'C']) manager.join('test', 'g1', name);
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 3);
  ok(manager.requestDismiss(ROOM, 1, 3));
  ok(manager.voteDismiss(ROOM, 2, true));
  ok(manager.move(ROOM, 2, tick));
  ok(manager.requestUndo(ROOM, 1));
  assert.equal(ok(manager.voteUndo(ROOM, 2, true)).currentPlayer, 2);
});

test('an undo past a dismissal runs the game hook for the dismissed player again', () => {
  // The restored state is from before the dismissal, so the game must clear the leaver out of it once more
  const leaveHook = { ...testGame, onPlayerLeft: (state: TestState) => ({ ...state, moves: state.moves + 100 }) };
  const manager = rememberingKeys(createGameManager([leaveHook], seededRandom), keys);
  for (const name of ['A', 'B', 'C']) manager.join('test', 'g1', name);
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  manager.disconnect(ROOM, 2);
  ok(manager.requestDismiss(ROOM, 1, 2));
  ok(manager.voteDismiss(ROOM, 3, true));
  ok(manager.requestUndo(ROOM, 1));
  const restored = ok(manager.voteUndo(ROOM, 3, true));
  assert.equal(restored.moves, 101);
  assert.equal(restored.currentPlayer, 3);
  assert.deepEqual(restored.activePlayers, [1, 3]);
  assert.equal(restored.gameStatus, 'Last turn undone');
});

test('an undo that ends the game again keeps the ending in the status', () => {
  // The re-run hook ends the game, as Phase 10 does when a tiebreak loses all but one player
  const endsOnLeave = {
    ...testGame,
    onPlayerLeft: (state: TestState) => ({ ...state, isGameOver: true, currentPlayer: null, winners: [3], gameStatus: 'C wins!' })
  };
  const manager = rememberingKeys(createGameManager([endsOnLeave], seededRandom), keys);
  for (const name of ['A', 'B', 'C']) manager.join('test', 'g1', name);
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 2);
  ok(manager.requestDismiss(ROOM, 1, 2));
  ok(manager.voteDismiss(ROOM, 3, true));
  ok(manager.requestUndo(ROOM, 1));
  const restored = ok(manager.voteUndo(ROOM, 3, true));
  assert.equal(restored.isGameOver, true);
  assert.equal(restored.gameStatus, 'Last turn undone. C wins!');
});

test('undoing the first move past a dismissal keeps the game started', () => {
  const manager = gameWith('A', 'B', 'C');
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 2);
  ok(manager.requestDismiss(ROOM, 1, 2));
  ok(manager.voteDismiss(ROOM, 3, true));
  ok(manager.requestUndo(ROOM, 1));
  const restored = ok(manager.voteUndo(ROOM, 3, true));
  assert.equal(restored.started, true);
  assert.deepEqual(restored.activePlayers, [1, 3]);
  assert.equal(restored.currentPlayer, 1);
  assert.equal(restored.moves, 0);
});
