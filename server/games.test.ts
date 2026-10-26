import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIVE_TTL_MS, createGameManager, EMPTY_ROOM_TIMEOUT_MS, type Reseat } from './games.ts';
import { agreeAll, fileOf, rememberingKeys, stepsOf } from './testing.ts';
import { openGameStore } from './store.ts';
import { hashDeviceId } from './devices.ts';
import type { ArchivedGame, GameStore, SavedRoom, StepChange } from './store.ts';
import { handGame, rulesGame, testGame, timedGame, TURN_MS, type TestPublicState, type TestState, type TimedState } from '../shared/testGame.ts';
import type { GameDefinition } from '../shared/gameDefinition.ts';
import { asRecord } from '../shared/messages.ts';
import { nextActivePlayer } from '../shared/seating.ts';
import type { BaseGameState, GameResult, HistoryStep, Random, Result, Seat } from '../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const tick = { type: 'tick' };
const ROOM = 'test/g1';
const GONE = { error: 'not-available' }; // what history and the game file answer to anyone not in the game
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

function seatKeyOf(manager: Manager, seat = 1): string {
  return manager.rawState(ROOM)?.seatKeys?.[seat] as string;
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
  assert.equal(stepsOf(manager, 'test')?.length, 2);
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

// testGame with a 'note' action the game records as a move and stamps with the server time
type NotedState = TestState & { notedAt: number | null };
const notingGame: GameDefinition<NotedState, TestPublicState> = {
  ...(testGame as unknown as GameDefinition<NotedState, TestPublicState>),
  recordsAction: (_state, _seat, action) => asRecord(action)?.type === 'note',
  applyAction(state, seat, action, random, now): Result<NotedState> {
    if (asRecord(action)?.type === 'note') return { state: { ...state, notedAt: now, gameStatus: `${state.playerNames[seat]} noted` } };
    return testGame.applyAction!(state, seat, action, random, now) as Result<NotedState>;
  }
};

function notingManager(): Manager {
  const manager = rememberingKeys(createGameManager([notingGame], seededRandom, undefined, { now: () => 1234 }), keys);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  return manager;
}

test('an action the game records goes on the timeline and can be undone', () => {
  const manager = notingManager();
  assert.equal(ok(manager.action(ROOM, 2, { type: 'note' })).gameStatus, 'B noted');
  assert.equal(current(manager).moveCount, 1);
  assert.equal(current(manager).started, true);
  ok(manager.requestUndo(ROOM, 1));
  assert.equal(ok(manager.voteUndo(ROOM, 2, true)).moveCount, 0);
});

test('an unrecorded action stays off the timeline', () => {
  const manager = notingManager();
  ok(manager.action(ROOM, 2, { type: 'ping' }));
  assert.equal(current(manager).moveCount, 0);
});

test('applyAction gets the server time', () => {
  const manager = notingManager();
  ok(manager.action(ROOM, 1, { type: 'note' }));
  assert.equal((manager.rawState(ROOM) as NotedState).notedAt, 1234);
});

test('a recorded action clears an open undo vote', () => {
  const manager = notingManager();
  ok(manager.move(ROOM, 1, tick));
  ok(manager.requestUndo(ROOM, 1));
  assert.ok(current(manager).undoVote);
  ok(manager.action(ROOM, 2, { type: 'note' }));
  assert.equal(current(manager).undoVote, null);
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
  for (const view of [back.state, manager.getState(ROOM, 2), ...(stepsOf(manager, 'test') ?? [])]) {
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
  assert.equal(stepsOf(manager, 'test'), null);
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
  const before = stepsOf(manager, 'test') as (TestPublicState & HistoryStep)[];
  assert.deepEqual(before.map(step => step.historyStep), ['start']);
  assert.equal(before[0].moveCount, 0);
  assert.equal(before[0].moves, 0);
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  const last = ok(manager.move(ROOM, 3, tick));
  assert.equal(last.moveCount, 3);

  const steps = stepsOf(manager, 'test') as (TestPublicState & HistoryStep)[] | null;
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
  assert.equal(stepsOf(manager, 'test')?.length, 3);

  const key = seatKeyOf(manager);
  assert.deepEqual(manager.history('test', ' g1 ', key), manager.history('test', 'g1', key)); // the game ID is trimmed
  assert.deepEqual(manager.history(' test ', ' g1 ', key), GONE);
  assert.deepEqual(manager.history('chess', 'g1', key), GONE);
  assert.deepEqual(manager.history('test', 'nope', key), GONE);
  assert.deepEqual(manager.history('test', 'a/b', key), GONE);
  assert.deepEqual(manager.history(undefined, undefined, key), GONE);
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
  assert.equal(stepsOf(manager, 'test')?.length, 2);
});

test('the start step is the board before the first move, also after undoing back to zero', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  const [start] = stepsOf(manager, 'test') as unknown as TestPublicState[];
  assert.equal(start.moves, 0);
  assert.deepEqual(start.playerNames, { 1: 'A', 2: 'B' });
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  const steps = stepsOf(manager, 'test') as HistoryStep[];
  assert.deepEqual(steps.map(step => step.historyStep), ['start']);
});

test('a game that ends outside a move gets an end step built from the live state', () => {
  const manager = gameWith('A', 'B', 'C');
  ok(manager.move(ROOM, 1, tick));
  left(manager.disconnect(ROOM, 2));
  left(manager.disconnect(ROOM, 3));
  ok(manager.requestDismiss(ROOM, 1, 2));
  ok(manager.requestDismiss(ROOM, 1, 3));
  const steps = stepsOf(manager, 'test') as HistoryStep[];
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
  assert.deepEqual((stepsOf(manager, 'test') as HistoryStep[]).map(s => s.historyStep), ['start', 'move']);
  ok(manager.action(ROOM, 2, { type: 'concede' }));
  assert.deepEqual((stepsOf(manager, 'test') as HistoryStep[]).map(s => s.historyStep), ['start', 'move', 'end']);
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  assert.deepEqual((stepsOf(manager, 'test') as HistoryStep[]).map(s => s.historyStep), ['start']);
});

test('a game won by a move has no end step', () => {
  const steps = stepsOf(wonGame(), 'test') as HistoryStep[];
  assert.deepEqual(steps.map(s => s.historyStep), ['start', 'move', 'move', 'move']);
});

test('gameFile refuses until the game is over', () => {
  const now = new Date('2026-10-18T20:15:00.000Z');
  assert.deepEqual(fileOf(gameWith('A', 'B'), 'test', now), { error: 'The game is not over yet' });
  assert.deepEqual(gameWith('A', 'B').gameFile('test', 'nope', 'key', now), GONE);
  assert.deepEqual(newManager().gameFile('chess', 'g1', 'key', now), GONE);
});

test('gameFile gives every step a table view and a view per seat', () => {
  const result = fileOf(wonGame(), 'test', new Date('2026-10-18T20:15:00.000Z'));
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
  const result = fileOf(manager, 'test', new Date());
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
  const archived = new Map<string, ArchivedGame>();
  return {
    written,
    archive: game => { archived.set(game.id, structuredClone(game)); },
    loadArchive: id => structuredClone(archived.get(id)),
    nextGameNumber: (gameType, gameId) =>
      Math.max(0, ...[...archived.values()].filter(g => g.gameType === gameType && g.gameId === gameId).map(g => g.n)) + 1,
    pruneArchive: before => {
      const old = [...archived.values()].filter(g => g.finishedAt < before);
      for (const game of old) archived.delete(game.id);
      return old.length;
    },
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

// testGame that never ends, so the game can run long
const endless = {
  ...testGame,
  applyMove: (state: TestState, seat: Seat) =>
    ({ state: { ...state, moves: state.moves + 1, currentPlayer: nextActivePlayer(state, seat) } })
};

test('a save late in a long game writes one step, not the whole history', () => {
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
  assert.equal(stepsOf(restart(store), 'test')?.length, 2);
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
  assert.equal(stepsOf(restarted, 'test')?.length, 2);
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

function rulesManager(store?: GameStore): Manager {
  return rememberingKeys(createGameManager([rulesGame], seededRandom, store), keys);
}

function rulesGameWith(...names: string[]): Manager {
  const manager = rulesManager();
  for (const name of names) manager.join('test', 'g1', name);
  return manager;
}

test('a move before everyone agreed is refused', () => {
  const manager = rulesGameWith('A', 'B');
  assert.deepEqual(manager.move(ROOM, 1, tick), { error: 'Everyone must agree to the house rules first' });
  ok(manager.agreeHouseRules(ROOM, 1, manager.getState(ROOM)?.houseRules?.revision));
  assert.deepEqual(manager.move(ROOM, 1, tick), { error: 'Everyone must agree to the house rules first' });
});

test('the move goes through once every seated player agreed', () => {
  const manager = rulesGameWith('A', 'B');
  agreeAll(manager, ROOM);
  assert.equal(ok(manager.move(ROOM, 1, tick)).started, true);
});

// rulesGame with an action that starts play, as a Hearts pass does
const startingGame: GameDefinition<TestState, TestPublicState> = {
  ...rulesGame,
  applyAction(state, seat, action, random, now) {
    if ((action as { type?: unknown } | null)?.type === 'start') return { state: { ...state, started: true, gameStatus: 'started' } };
    return testGame.applyAction!(state, seat, action, random, now);
  }
};

test('an action that would start play before everyone agreed is refused and changes nothing', () => {
  const manager = rememberingKeys(createGameManager([startingGame], seededRandom), keys);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  const before = manager.rawState(ROOM);
  assert.deepEqual(manager.action(ROOM, 1, { type: 'start' }), { error: 'Everyone must agree to the house rules first' });
  assert.equal(manager.rawState(ROOM), before);
  assert.equal(ok(manager.action(ROOM, 1, { type: 'ping' })).started, false); // a lobby action still works
  agreeAll(manager, ROOM);
  assert.equal(ok(manager.action(ROOM, 1, { type: 'start' })).started, true);
});

test('a game with no house rules and no stretched range needs no agreement', () => {
  assert.equal(ok(gameWith('A', 'B').move(ROOM, 1, tick)).started, true);
});

test('only the host may set the house rules and a change clears the agreements', () => {
  const manager = rulesGameWith('A', 'B');
  const proposal = { values: { fast: true }, maxPlayers: null };
  assert.deepEqual(manager.setHouseRules(ROOM, 2, proposal), { error: 'Only the host can change the house rules' });
  assert.deepEqual(manager.setHouseRules(ROOM, 3, proposal), { error: 'You are not in this game' });
  ok(manager.agreeHouseRules(ROOM, 2, manager.getState(ROOM)?.houseRules?.revision));
  const view = ok(manager.setHouseRules(ROOM, 1, proposal));
  assert.equal(view.houseRules?.values.fast, true);
  assert.deepEqual(view.houseRules?.agreed, []);
});

test('an agreement to an old revision is refused after the host changed the rules', () => {
  const manager = rulesGameWith('A', 'B');
  const seen = manager.getState(ROOM)?.houseRules?.revision;
  ok(manager.setHouseRules(ROOM, 1, { values: { goal: 5 }, maxPlayers: null }));
  assert.deepEqual(manager.agreeHouseRules(ROOM, 2, seen), { error: 'The house rules changed. Check them and agree again' });
  assert.deepEqual(manager.getState(ROOM)?.houseRules?.agreed, []);
});

test('a move that names an old move count is refused', () => {
  const manager = rulesGameWith('A', 'B');
  agreeAll(manager, ROOM);
  assert.equal(ok(manager.move(ROOM, 1, tick, 0)).moveCount, 1);
  assert.deepEqual(manager.move(ROOM, 2, tick, 0), { error: 'Someone else moved first' });
  assert.equal(ok(manager.move(ROOM, 2, tick, 1)).moveCount, 2);
});

test('every view, history step and game file step carries the house rules', () => {
  const manager = rulesGameWith('A', 'B');
  agreeAll(manager, ROOM);
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  ok(manager.move(ROOM, 1, tick));
  const file = fileOf(manager, 'test', new Date());
  assert.ok(file && 'file' in file);
  const views = [manager.getState(ROOM, 1), manager.getState(ROOM, null), ...(stepsOf(manager, 'test') ?? []), ...file.file.steps];
  assert.equal(views.length, 2 + 4 + 4);
  for (const view of views) assert.equal(view?.houseRules?.host, 1);
});

test('a game saved without house rules loads, plays and builds its history', () => {
  const store = memoryStore();
  const manager = rulesManager(store);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  agreeAll(manager, ROOM);
  ok(manager.move(ROOM, 1, tick));
  const old = saved(store);
  const strip = (state: BaseGameState) => { const { houseRules: _rules, ...rest } = state; return rest as BaseGameState; };
  const legacy = memoryStore();
  legacy.save(ROOM, 'test', strip(old.state), { type: 'push', index: 0, before: strip(old.history[0]), after: strip(old.timeline[0]) });
  const back = rulesManager(legacy);
  assert.equal(back.getState(ROOM)?.houseRules?.host, 1);
  assert.equal(stepsOf(back, 'test')?.length, 2);
  joined(back.join('test', 'g1', 'A', true));
  joined(back.join('test', 'g1', 'B', true));
  assert.equal(ok(back.move(ROOM, 2, tick)).moveCount, 2);
});

test('the house rules survive a restart', () => {
  const store = openGameStore(':memory:');
  const manager = rulesManager(store);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  ok(manager.setHouseRules(ROOM, 1, { values: { fast: true, goal: 5 }, maxPlayers: null }));
  agreeAll(manager, ROOM);
  ok(manager.move(ROOM, 1, tick));
  const rules = rulesManager(store).getState(ROOM)?.houseRules;
  assert.equal(rules?.values.goal, 5);
  assert.equal(rules?.values.fast, true);
  assert.deepEqual(rules?.agreed, [1, 2]);
});

// A manager for timedGame whose clock the test sets; `changed` lists each room the manager reported
function timedManager(
  t: TestContext, store?: GameStore, game: GameDefinition<TimedState, TestPublicState> = timedGame, start = 100_000
) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clock = { now: start };
  const changed: string[] = [];
  const manager = rememberingKeys(
    createGameManager([game], seededRandom, store, { now: () => clock.now, changed: roomId => changed.push(roomId) }), keys
  );
  // Moves the test's clock and the mocked timers together
  const advance = (ms: number) => { clock.now += ms; t.mock.timers.tick(ms); };
  return { manager, clock, changed, advance };
}

function timedTable(t: TestContext, store?: GameStore, game?: GameDefinition<TimedState, TestPublicState>) {
  const timed = timedManager(t, store, game);
  timed.manager.join('test', 'g1', 'A');
  timed.manager.join('test', 'g1', 'B');
  agreeAll(timed.manager, ROOM);
  return timed;
}

test('a deadline passing makes the game\'s timeout move and tells the server', (t: TestContext) => {
  const { manager, changed, advance } = timedTable(t);
  assert.equal(current(manager).serverTime, 100_000);
  advance(TURN_MS - 1);
  assert.equal(current(manager).currentPlayer, 1);
  assert.deepEqual(changed, []);
  advance(1);
  assert.equal(current(manager).currentPlayer, 2);
  assert.equal(current(manager).gameStatus, 'A ran out of time');
  assert.equal(current(manager).started, true);
  assert.equal(current(manager).moveCount, 1);
  assert.equal(current(manager).serverTime, 100_000 + TURN_MS);
  assert.deepEqual(changed, [ROOM]);
  assert.equal(stepsOf(manager, 'test')?.[1].serverTime, undefined); // live views only
});

test('a timeout is a move and can be undone', (t: TestContext) => {
  const { manager, advance } = timedTable(t);
  advance(TURN_MS);
  ok(manager.requestUndo(ROOM, 2));
  ok(manager.voteUndo(ROOM, 1, true));
  assert.equal(current(manager).currentPlayer, 1);
  assert.equal(current(manager).moveCount, 0);
});

test('the clock starts when everyone has agreed', (t: TestContext) => {
  const resumeClock = t.mock.fn(timedGame.resumeClock);
  const { manager, advance } = timedManager(t, undefined, { ...timedGame, resumeClock });
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  const revision = current(manager).houseRules?.revision;
  ok(manager.agreeHouseRules(ROOM, 1, revision));
  advance(5 * TURN_MS); // nobody's clock runs while waiting for agreement
  assert.equal(resumeClock.mock.callCount(), 0);
  assert.equal(current(manager).moveCount, 0);
  ok(manager.agreeHouseRules(ROOM, 2, revision));
  ok(manager.agreeHouseRules(ROOM, 2, revision)); // a repeat does not restart it
  assert.equal(resumeClock.mock.callCount(), 1);
  advance(TURN_MS);
  assert.equal(current(manager).gameStatus, 'A ran out of time');
});

test('an undo restarts the clock from the moment of the undo', (t: TestContext) => {
  const { manager, advance } = timedTable(t);
  ok(manager.move(ROOM, 1, tick));
  advance(TURN_MS / 2);
  ok(manager.requestUndo(ROOM, 2));
  advance(TURN_MS / 4); // an open vote does not pause the clock
  ok(manager.voteUndo(ROOM, 1, true));
  assert.equal(current(manager).currentPlayer, 1);
  advance(TURN_MS - 1);
  assert.equal(current(manager).currentPlayer, 1);
  advance(1);
  assert.equal(current(manager).gameStatus, 'A ran out of time');
});

test('a restart does not charge the time the server was down', (t: TestContext) => {
  const store = memoryStore();
  const { manager } = timedTable(t, store);
  ok(manager.move(ROOM, 1, tick)); // B's turn ends at 101_000
  t.mock.timers.reset();

  const back = timedManager(t, store, timedGame, 100_000 + 10 * TURN_MS); // loaded long after the saved deadline
  assert.equal(current(back.manager).currentPlayer, 2);
  back.advance(TURN_MS - 1);
  assert.equal(current(back.manager).currentPlayer, 2);
  assert.deepEqual(back.changed, []);
  back.advance(1);
  assert.equal(current(back.manager).gameStatus, 'B ran out of time');
});

test('a deleted room\'s deadline never fires', (t: TestContext) => {
  const { manager, changed, advance } = timedTable(t); // the clock runs from the last agreement
  manager.disconnect(ROOM, 1);
  manager.disconnect(ROOM, 2); // the last one out of the lobby deletes the room
  advance(TURN_MS);
  assert.equal(manager.getState(ROOM), undefined);
  assert.deepEqual(changed, []);
});

test('a timeout cancels an open undo vote, which was for the move before it', (t: TestContext) => {
  const { manager, advance } = timedTable(t);
  ok(manager.move(ROOM, 1, tick));
  ok(manager.requestUndo(ROOM, 1));
  advance(TURN_MS);
  assert.equal(current(manager).gameStatus, 'B ran out of time');
  assert.equal(current(manager).undoVote, null);
  assert.equal(current(manager).moveCount, 2);
});

test('a join after everyone agreed stops the clock until they agree again', (t: TestContext) => {
  const { manager, advance } = timedTable(t);
  manager.join('test', 'g1', 'C'); // clears the agreements
  advance(5 * TURN_MS);
  assert.equal(current(manager).moveCount, 0);
  assert.equal(current(manager).started, false);
  agreeAll(manager, ROOM);
  advance(TURN_MS - 1);
  assert.equal(current(manager).moveCount, 0);
  advance(1);
  assert.equal(current(manager).gameStatus, 'A ran out of time');
});

test('a leave down to one player stops the clock', (t: TestContext) => {
  const { manager, changed, advance } = timedTable(t);
  manager.disconnect(ROOM, 2);
  agreeAll(manager, ROOM); // the one left agrees, but one player cannot start
  advance(5 * TURN_MS);
  assert.equal(current(manager).moveCount, 0);
  assert.equal(current(manager).started, false);
  assert.deepEqual(changed, []);
});

test('a timeout that leaves its deadline already past is not run again', (t: TestContext) => {
  const logged = t.mock.method(console, 'error', () => {});
  const stuck: GameDefinition<TimedState, TestPublicState> = { ...timedGame, onDeadline: state => state };
  const { manager, advance } = timedTable(t, undefined, stuck);
  advance(TURN_MS);
  advance(5 * TURN_MS);
  assert.equal(current(manager).moveCount, 1);
  assert.equal(logged.mock.callCount(), 1);
});

type AnyGame = Parameters<typeof createGameManager>[0][number];

// A manager whose clock the test sets, listing each game it reported finished
function reporting(store?: GameStore, game: AnyGame = testGame) {
  const clock = { now: 1000 };
  const results: GameResult[] = [];
  const manager = rememberingKeys(
    createGameManager([game], seededRandom, store, { now: () => clock.now, onGameFinished: result => results.push(result) }),
    keys
  );
  return { manager, clock, results };
}

function reportingTable(store?: GameStore, game?: AnyGame) {
  const table = reporting(store, game);
  table.manager.join('test', 'g1', 'A');
  table.manager.join('test', 'g1', 'B');
  return table;
}

// wonGame's three ticks, one second apart, the first at 2000
function playToWin({ manager, clock }: ReturnType<typeof reporting>): void {
  for (const seat of [1, 2, 1]) {
    clock.now += 1000;
    ok(manager.move(ROOM, seat, tick));
  }
}

test('onGameFinished reports a game that ends on a move', () => {
  const table = reportingTable();
  playToWin(table);
  assert.deepEqual(table.results, [{
    archiveId: 'test/g1#1', gameType: 'test', gameId: 'g1', startedAt: 2000, finishedAt: 4000, moveCount: 3,
    standings: [{ seat: 1, place: 1 }, { seat: 2, place: 2 }],
    players: [{ seat: 1, name: 'A' }, { seat: 2, name: 'B' }]
  }]);
});

test('onGameFinished reports a game that ends outside a move', (t: TestContext) => {
  const conceded = reportingTable();
  ok(conceded.manager.move(ROOM, 1, tick));
  ok(conceded.manager.action(ROOM, 2, { type: 'concede' }));
  assert.equal(conceded.results.length, 1);
  assert.deepEqual(conceded.results[0].standings, [{ seat: 1, place: 1 }, { seat: 2, place: 2 }]);
  assert.equal('abandoned' in conceded.results[0], false);

  // A dismissal leaving one player is the platform ending the game, so it is abandoned
  const dismissed = reportingTable();
  ok(dismissed.manager.move(ROOM, 1, tick));
  dismissed.manager.disconnect(ROOM, 2);
  ok(dismissed.manager.requestDismiss(ROOM, 1, 2));
  assert.equal(dismissed.results.length, 1);
  assert.equal(dismissed.results[0].abandoned, true);
  assert.deepEqual(dismissed.results[0].players, [{ seat: 1, name: 'A' }]);

  // timedGame never ends on a timeout, so this one does
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fatal: GameDefinition<TimedState, TestPublicState> = {
    ...timedGame, onDeadline: state => ({ ...state, isGameOver: true, currentPlayer: null, winners: [2], turnEndsAt: null })
  };
  const timed = reportingTable(undefined, fatal);
  agreeAll(timed.manager, ROOM);
  timed.clock.now += TURN_MS;
  t.mock.timers.tick(TURN_MS);
  assert.equal(timed.results.length, 1);
  assert.equal(timed.results[0].moveCount, 1);
  assert.deepEqual(timed.results[0].standings, [{ seat: 2, place: 1 }, { seat: 1, place: 2 }]);
});

test('later changes to a finished game do not report it again', () => {
  const table = reportingTable();
  playToWin(table);
  ok(table.manager.requestUndo(ROOM, 1));
  ok(table.manager.voteUndo(ROOM, 2, false));
  table.manager.disconnect(ROOM, 2);
  joined(table.manager.join('test', 'g1', 'B'));
  assert.equal(table.results.length, 1);
});

test('an undo after game over and a second ending report once', () => {
  const table = reportingTable();
  playToWin(table);
  ok(table.manager.requestUndo(ROOM, 1));
  ok(table.manager.voteUndo(ROOM, 2, true));
  table.clock.now += 1000;
  assert.equal(ok(table.manager.move(ROOM, 1, tick)).isGameOver, true);
  assert.equal(table.results.length, 1);
  assert.equal(table.manager.rawState(ROOM)?.finishedAt, 4000);
});

test('a throwing onGameFinished is logged and the game goes on', (t: TestContext) => {
  const logged = t.mock.method(console, 'error', () => {});
  const manager = createGameManager([testGame], seededRandom, undefined, { onGameFinished: () => { throw new Error('down'); } });
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  assert.equal(ok(manager.move(ROOM, 1, tick)).isGameOver, true);
  assert.equal(logged.mock.callCount(), 1);
});

test('a finished game saved before this change loads without reporting', () => {
  const store = memoryStore();
  const { manager } = reportingTable(store);
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  ok(manager.move(ROOM, 1, tick));
  const { startedAt: _startedAt, finishedAt: _finishedAt, ...legacy } = saved(store).state;
  store.save(ROOM, 'test', legacy);

  const back = reporting(store);
  assert.deepEqual(back.results, []);
  const state = back.manager.getState(ROOM);
  assert.equal(state?.finishedAt, 1000);
  assert.deepEqual(state?.standings, [{ seat: 1, place: 1 }, { seat: 2, place: 2 }]);
});

test('startedAt survives a restart', () => {
  const store = memoryStore();
  const table = reportingTable(store);
  table.clock.now = 5000;
  ok(table.manager.move(ROOM, 1, tick));
  assert.equal(table.manager.getState(ROOM)?.startedAt, 5000);
  assert.equal(reporting(store).manager.getState(ROOM)?.startedAt, 5000);
});

test("only a finished game's view carries standings", () => {
  const table = reportingTable();
  ok(table.manager.move(ROOM, 1, tick));
  assert.equal('standings' in current(table.manager), false);
  ok(table.manager.move(ROOM, 2, tick));
  ok(table.manager.move(ROOM, 1, tick));
  assert.deepEqual(current(table.manager).standings, table.results[0].standings);
});

test('open games lists lobbies and games in progress with names only', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  manager.join('test', 'g2', 'C');
  assert.deepEqual(manager.openGames(), [
    { gameType: 'test', gameId: 'g2', players: ['C'], playing: false },
    { gameType: 'test', gameId: 'g1', players: ['A', 'B'], playing: true }
  ]);
});

test('open games never carry a key', () => {
  const manager = gameWith('A', 'B');
  manager.join('test', 'g2', 'C');
  const open = manager.openGames();
  assert.ok(open.length > 0 && keys.size > 0);
  for (const entry of open) assert.deepEqual(Object.keys(entry).sort(), ['gameId', 'gameType', 'players', 'playing']);
  for (const key of keys.values()) assert.ok(!JSON.stringify(open).includes(key));
});

test('finished games and games everyone left are not listed', () => {
  assert.deepEqual(wonGame().openGames(), []);

  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 1);
  manager.disconnect(ROOM, 2);
  assert.deepEqual(manager.openGames(), []);
});

test('a game waiting on one disconnected player is still listed as playing', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 2);
  assert.deepEqual(manager.openGames(), [{ gameType: 'test', gameId: 'g1', players: ['A', 'B'], playing: true }]);
});

// The never-ending game on a clock the test moves, with A and B seated and two moves made
function reactionTable(store?: GameStore) {
  const clock = { now: 1000 };
  const manager = rememberingKeys(createGameManager([endless], seededRandom, store, { now: () => clock.now }), keys);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  return { manager, clock };
}

test('a reaction is recorded with the move count and changes nothing else', () => {
  const { manager } = reactionTable();
  const { serverTime: _before, ...before } = manager.getState(ROOM, 1) ?? {};
  assert.deepEqual(manager.react(ROOM, 1, 2, '😂'), {
    reaction: { from: 'A', fromSpectator: false, target: 2, emoji: '😂', at: 1000 }
  });
  const { serverTime: _after, ...after } = manager.getState(ROOM, 1) ?? {};
  assert.deepEqual(after, before);
  assert.deepEqual(manager.rawState(ROOM)?.reactions, [
    { from: 'A', fromSpectator: false, target: 2, emoji: '😂', at: 1000, moveCount: 2 }
  ]);
});

test('reactions are refused unless one emoji goes to another seated player during play', () => {
  const { manager } = reactionTable();
  assert.deepEqual(manager.react(ROOM, 1, 2, 'hi'), { error: 'Send a single emoji' });
  assert.deepEqual(manager.react(ROOM, 1, 2, '😂😂'), { error: 'Send a single emoji' });
  assert.deepEqual(manager.react(ROOM, 1, 1, '😂'), { error: 'Pick another player to react to' });
  assert.deepEqual(manager.react(ROOM, 1, 9, '😂'), { error: 'That player is not in this game' });
  assert.deepEqual(manager.react(ROOM, 5, 2, '😂'), { error: 'You are not in this game' });
  assert.deepEqual(gameWith('A', 'B').react(ROOM, 1, 2, '😂'), { error: 'Reactions open once the game starts' });
  assert.deepEqual(wonGame().react(ROOM, 1, 2, '😂'), { error: 'Reactions open once the game starts' });
});

test('the cooldown is 15 seconds per sender', () => {
  const { manager, clock } = reactionTable();
  assert.ok('reaction' in manager.react(ROOM, 1, 2, '😂'));
  clock.now += 14_999;
  assert.deepEqual(manager.react(ROOM, 1, 2, '👍'), { error: 'You can react again in 1 s' });
  assert.ok('reaction' in manager.react(ROOM, 2, 1, '👍'));
  clock.now += 1;
  assert.ok('reaction' in manager.react(ROOM, 1, 2, '👍'));
});

test('reactions never reach a view or an undo snapshot', () => {
  const steps: StepChange[] = [];
  const store: GameStore = {
    ...memoryStore(),
    loadAll: () => new Map(),
    save: (_roomId, _gameType, _state, step) => { if (step) steps.push(step); },
    remove: () => {}
  };
  const { manager } = reactionTable(store);
  assert.ok('reaction' in manager.react(ROOM, 1, 2, '😂'));
  ok(manager.move(ROOM, 1, tick));
  for (const seat of [1, 2, null]) assert.equal('reactions' in (manager.getState(ROOM, seat) ?? {}), false);
  const pushed = steps.filter(step => step.type === 'push');
  assert.equal(pushed.length, 3);
  for (const step of pushed) {
    assert.equal('reactions' in step.before, false);
    assert.equal('reactions' in step.after, false);
  }
});

test('an undo keeps reactions and moves later ones back to the remaining step', () => {
  const { manager } = reactionTable();
  ok(manager.move(ROOM, 1, tick));
  assert.ok('reaction' in manager.react(ROOM, 1, 2, '😂'));
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  const reactions = manager.rawState(ROOM)?.reactions;
  assert.equal(reactions?.length, 1);
  assert.equal(reactions?.[0].moveCount, 2);
  assert.equal(current(manager).moveCount, 2);
});

test('reactions survive a restart', () => {
  const store = openGameStore(':memory:');
  const { manager } = reactionTable(store);
  assert.ok('reaction' in manager.react(ROOM, 1, 2, '😂'));
  const back = rememberingKeys(createGameManager([endless], seededRandom, store), keys);
  assert.equal(back.rawState(ROOM)?.reactions?.[0].emoji, '😂');
});

test('the reaction log keeps the last 200', () => {
  const { manager, clock } = reactionTable();
  for (let i = 0; i < 201; i++) {
    assert.ok('reaction' in manager.react(ROOM, 1, 2, '😂'));
    clock.now += 15_000;
  }
  const reactions = manager.rawState(ROOM)?.reactions ?? [];
  assert.equal(reactions.length, 200);
  assert.equal(reactions[0].at, 1000 + 15_000);
});

test('history and the game file show each reaction at its step', () => {
  const clock = { now: 1000 };
  const manager = rememberingKeys(createGameManager([testGame], seededRandom, undefined, { now: () => clock.now }), keys);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  assert.ok('reaction' in manager.react(ROOM, 1, 2, '😂'));
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  assert.ok('reaction' in manager.react(ROOM, 2, 1, '👍'));
  ok(manager.move(ROOM, 1, tick));
  assert.deepEqual(manager.react(ROOM, 1, 2, '😂'), { error: 'Reactions open once the game starts' });
  const first = { from: 'A', fromSpectator: false, target: 2, emoji: '😂', at: 1000 };
  const second = { from: 'B', fromSpectator: false, target: 1, emoji: '👍', at: 1000 };
  const steps = stepsOf(manager, 'test') ?? [];
  assert.deepEqual(steps.map(step => step.historyStep), ['start', 'move', 'move', 'move']);
  assert.deepEqual(steps.map(step => step.reactions), [[first], undefined, [second], undefined]);
  const file = fileOf(manager, 'test', new Date());
  assert.ok(file && 'file' in file);
  for (const [i, step] of file.file.steps.entries()) {
    assert.deepEqual(step.reactions, steps[i].reactions);
    for (const view of Object.values(step.views ?? {})) assert.deepEqual(view.reactions, step.reactions);
  }
  const quiet = fileOf(wonGame(), 'test', new Date());
  assert.ok(quiet && 'file' in quiet);
  for (const step of quiet.file.steps) {
    assert.equal('reactions' in step, false);
    for (const view of Object.values(step.views ?? {})) assert.equal('reactions' in view, false);
  }
});

test('the end moment owns the reactions it shares a move count with', () => {
  for (const moves of [0, 2]) {
    const manager = gameWith('A', 'B');
    ok(manager.move(ROOM, 1, tick));
    if (moves === 0) {
      ok(manager.requestUndo(ROOM, 1));
      ok(manager.voteUndo(ROOM, 2, true));
    } else {
      ok(manager.move(ROOM, 2, tick));
    }
    assert.ok('reaction' in manager.react(ROOM, 1, 2, '😂'));
    const raw = manager.rawState(ROOM);
    assert.ok(raw && manager.replaceState(ROOM, { ...raw, isGameOver: true }));
    const steps = stepsOf(manager, 'test') ?? [];
    assert.deepEqual(steps.map(step => step.historyStep), moves === 0 ? ['start', 'end'] : ['start', 'move', 'move', 'end']);
    assert.deepEqual(steps.map(step => step.reactions?.length), moves === 0 ? [undefined, 1] : [undefined, undefined, undefined, 1]);
  }
});

// A two-player test game with the turn timer set and a clock the test moves
function timerTable(store?: GameStore, timer = 30) {
  const clock = { now: 100_000 };
  const manager = rememberingKeys(createGameManager([testGame], seededRandom, store, { now: () => clock.now }), keys);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  if (timer) ok(manager.setHouseRules(ROOM, 1, { values: { turnTimer: timer }, maxPlayers: null }));
  agreeAll(manager, ROOM);
  return { manager, clock };
}

test('the turn timer starts when everyone agreed and restarts for each new player', () => {
  const { manager, clock } = timerTable();
  assert.equal(current(manager).turnStartedAt, 100_000);
  clock.now += 5000;
  ok(manager.move(ROOM, 1, tick));
  assert.equal(current(manager).turnStartedAt, 105_000);
});

test('running out of turn time records nothing', () => {
  const { manager, clock } = timerTable();
  const before = current(manager);
  const steps = stepsOf(manager, 'test')!.length;
  clock.now += 10 * 60 * 1000;
  const after = current(manager);
  assert.equal(after.moveCount, before.moveCount);
  assert.equal(after.gameStatus, before.gameStatus);
  assert.equal(after.currentPlayer, before.currentPlayer);
  assert.equal(stepsOf(manager, 'test')!.length, steps);
  assert.equal(ok(manager.move(ROOM, 1, tick)).moveCount, 1);
});

test('an undo vote pauses the turn timer and the timeline is untouched', () => {
  const { manager, clock } = timerTable();
  ok(manager.move(ROOM, 1, tick));
  const started = current(manager).turnStartedAt as number;
  const steps = stepsOf(manager, 'test')!.length;
  ok(manager.requestUndo(ROOM, 1));
  assert.equal(current(manager).turnPausedAt, clock.now);
  clock.now += 20_000;
  ok(manager.voteUndo(ROOM, 2, false));
  assert.equal(current(manager).turnStartedAt, started + 20_000);
  assert.equal(current(manager).turnPausedAt, null);
  assert.equal(stepsOf(manager, 'test')!.length, steps);
});

test('an undo and a restart each give a fresh full turn', () => {
  const store = openGameStore(':memory:');
  const { manager, clock } = timerTable(store);
  ok(manager.move(ROOM, 1, tick));
  clock.now += 7000;
  ok(manager.requestUndo(ROOM, 2));
  ok(manager.voteUndo(ROOM, 1, true));
  assert.equal(current(manager).turnStartedAt, clock.now);
  const restartedAt = clock.now + 60_000;
  const back = rememberingKeys(createGameManager([testGame], seededRandom, store, { now: () => restartedAt }), keys);
  assert.equal(current(back).turnStartedAt, restartedAt);
});

test('with the timer off views carry no turn stamp', () => {
  const { manager } = timerTable(undefined, 0);
  ok(manager.move(ROOM, 1, tick));
  assert.equal('turnStartedAt' in current(manager), false);
  assert.equal('turnPausedAt' in current(manager), false);
});

test('the timer stops when the game is over', () => {
  const { manager } = timerTable();
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  ok(manager.move(ROOM, 1, tick));
  assert.equal(current(manager).turnStartedAt, null);
});

test('switching the timer off in the lobby leaves no stamp in views, history or the store', () => {
  const store = openGameStore(':memory:');
  const { manager } = timerTable(store);
  ok(manager.setHouseRules(ROOM, 1, { values: { turnTimer: 0 }, maxPlayers: null }));
  agreeAll(manager, ROOM);
  ok(manager.move(ROOM, 1, tick));
  assert.equal('turnStartedAt' in current(manager), false);
  assert.equal('turnPausedAt' in current(manager), false);
  assert.equal('turnStartedAt' in (store.loadAll().get(ROOM)?.state ?? {}), false);
});

test('history views never carry the turn stamp', () => {
  const { manager } = timerTable();
  ok(manager.move(ROOM, 1, tick));
  assert.equal('turnStartedAt' in current(manager), true);
  for (const step of stepsOf(manager, 'test')!) {
    assert.equal('turnStartedAt' in step, false);
    assert.equal('turnPausedAt' in step, false);
  }
});

type SimState = TestState & { ticks: number };
const simGame = (endsGame = false): GameDefinition<SimState, TestPublicState> => ({
  ...(testGame as unknown as GameDefinition<SimState, TestPublicState>),
  createGameState: gameId => ({ ...testGame.createGameState(gameId), ticks: 0 }),
  simulating: s => s.moves === 1 && s.ticks < 4,
  simulate: s => ({ ...s, ticks: s.ticks + 1, isGameOver: endsGame && s.ticks === 3 })
});

// A table with two players; `changed` lists each broadcast
function simTable(t: TestContext, options: { game?: GameDefinition<SimState, TestPublicState>; store?: GameStore; manual?: boolean } = {}) {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const changed: string[] = [];
  const hooks = { changed: (roomId: string) => changed.push(roomId), manualSimulation: options.manual };
  const manager = rememberingKeys(createGameManager([options.game ?? simGame()], seededRandom, options.store, hooks), keys);
  manager.join('test', 'g1', 'A');
  manager.join('test', 'g1', 'B');
  return { manager, changed };
}

const ticksOf = (manager: Manager) => (manager.rawState(ROOM) as SimState).ticks;

test('a simulating game ticks every 50 ms and broadcasts each tick without recording it', (t: TestContext) => {
  const { manager, changed } = simTable(t);
  ok(manager.move(ROOM, 1, tick));
  t.mock.timers.tick(50 * 4);
  assert.equal(ticksOf(manager), 4);
  assert.equal(changed.length, 4);
  assert.equal(current(manager).moveCount, 1);
  t.mock.timers.tick(50 * 4);
  assert.equal(ticksOf(manager), 4);
});

test('the store is written once when a simulation stops, not on every tick', (t: TestContext) => {
  const store = memoryStore();
  const { manager } = simTable(t, { store });
  ok(manager.move(ROOM, 1, tick));
  const before = store.written.length;
  t.mock.timers.tick(50 * 3);
  assert.equal(store.written.length, before);
  t.mock.timers.tick(50);
  assert.equal(store.written.length, before + 1);
  assert.equal((saved(store).state as SimState).ticks, 4);
});

test('a tick that ends the game is recorded as a move and cancels an open undo vote', (t: TestContext) => {
  const { manager } = simTable(t, { game: simGame(true) });
  ok(manager.move(ROOM, 1, tick));
  ok(manager.requestUndo(ROOM, 1));
  t.mock.timers.tick(50 * 4);
  assert.equal(current(manager).isGameOver, true);
  assert.equal(current(manager).moveCount, 2);
  assert.equal(current(manager).undoVote, null);
  assert.equal(stepsOf(manager, 'test')?.at(-1)?.historyStep, 'move');
});

test('deleting a room stops its simulation', (t: TestContext) => {
  const endless = { ...simGame(), simulating: (s: SimState) => s.moves === 1 };
  const { manager, changed } = simTable(t, { game: endless });
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 1);
  manager.disconnect(ROOM, 2);
  t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS);
  assert.equal(manager.getState(ROOM), undefined);
  const count = changed.length;
  t.mock.timers.tick(1000);
  assert.equal(changed.length, count);
});

test('a room loaded while simulating resumes its simulation', (t: TestContext) => {
  const store = memoryStore();
  const game = simGame();
  store.save(ROOM, 'test', { ...game.createGameState('g1'), started: true, moves: 1, ticks: 1 } as BaseGameState);
  t.mock.timers.enable({ apis: ['setInterval'] });
  const manager = createGameManager([game], seededRandom, store);
  t.mock.timers.tick(50 * 5);
  assert.equal(ticksOf(manager), 4);
});

test('a simulation stopped by another change stops ticking', (t: TestContext) => {
  const endless = { ...simGame(), simulating: (s: SimState) => s.moves === 1 && !s.isGameOver };
  const { manager, changed } = simTable(t, { game: endless });
  ok(manager.move(ROOM, 1, tick));
  t.mock.timers.tick(100);
  const count = changed.length;
  assert.ok(manager.replaceState(ROOM, { ...manager.rawState(ROOM)!, isGameOver: true }));
  t.mock.timers.tick(500);
  assert.equal(changed.length, count);
  assert.equal(ticksOf(manager), 2);
});

test('a simulation that throws is logged and stops ticking', (t: TestContext) => {
  const logged = t.mock.method(console, 'error', () => {});
  const broken = { ...simGame(), simulate: () => { throw new Error('boom'); } };
  const { manager, changed } = simTable(t, { game: broken });
  ok(manager.move(ROOM, 1, tick));
  t.mock.timers.tick(500);
  assert.equal(logged.mock.callCount(), 1);
  assert.deepEqual(changed, []);
});

test('with manualSimulation no timer runs and simulateTicks steps the room', (t: TestContext) => {
  const { manager } = simTable(t, { manual: true });
  ok(manager.move(ROOM, 1, tick));
  t.mock.timers.tick(1000);
  assert.equal(ticksOf(manager), 0);
  assert.equal(manager.simulateTicks(ROOM, 2), true);
  assert.equal(ticksOf(manager), 2);
  assert.equal(manager.simulateTicks('test/none', 2), false);
});

// A game won by its third move, played on a store
function wonOn(store: GameStore, t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const table = reportingTable(store);
  playToWin(table);
  return table;
}

// Everyone leaves, so the empty-room timer deletes the room
function deleteEmptyRoom(manager: Manager, t: TestContext): void {
  manager.disconnect(ROOM, 1);
  manager.disconnect(ROOM, 2);
  t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS);
  assert.equal(manager.getState(ROOM), undefined);
}

test('a finished game is archived under its archive id', (t: TestContext) => {
  const store = memoryStore();
  const { results } = wonOn(store, t);
  const archived = store.loadArchive('test/g1#1');
  assert.equal(archived?.timeline.length, 3);
  assert.equal(archived?.state.isGameOver, true);
  assert.equal(archived?.finishedAt, 4000);
  assert.equal(results[0].archiveId, archived?.id);
});

test('a game ID used again after its room was deleted continues the numbering', (t: TestContext) => {
  const store = memoryStore();
  const { manager } = wonOn(store, t);
  deleteEmptyRoom(manager, t);
  const before = store.loadArchive('test/g1#1');
  manager.join('test', 'g1', 'A');
  assert.equal(manager.rawState(ROOM)?.gameNumber, 2);
  manager.join('test', 'g1', 'B');
  assert.deepEqual(store.loadArchive('test/g1#1'), before);
});

test('archives older than 90 days are pruned when the manager starts', () => {
  const store = memoryStore();
  const game = (n: number, finishedAt: number) => ({
    id: `test/old#${n}`, gameType: 'test', gameId: 'old', n, finishedAt, state: {}, history: [], timeline: []
  }) as unknown as ArchivedGame;
  const at = 10 * ARCHIVE_TTL_MS;
  store.archive(game(1, at - ARCHIVE_TTL_MS - 1));
  store.archive(game(2, at - ARCHIVE_TTL_MS + 1));
  createGameManager([testGame], seededRandom, store, { now: () => at });
  assert.equal(store.loadArchive('test/old#1'), undefined);
  assert.ok(store.loadArchive('test/old#2'));
});

test('archives are pruned again every 24 hours', (t: TestContext) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const store = memoryStore();
  const clock = { now: 0 };
  createGameManager([testGame], seededRandom, store, { now: () => clock.now });
  store.archive({ id: 'test/old#1', gameType: 'test', gameId: 'old', n: 1, finishedAt: 0 } as ArchivedGame);
  clock.now = ARCHIVE_TTL_MS + 1;
  t.mock.timers.tick(24 * 60 * 60 * 1000);
  assert.equal(store.loadArchive('test/old#1'), undefined);
});

test('an undo after game over and a replay archive the final game', (t: TestContext) => {
  const store = memoryStore();
  const table = wonOn(store, t);
  const { manager } = table;
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  table.clock.now += 1000;
  ok(manager.move(ROOM, 1, tick));
  assert.equal(table.results.length, 1); // the first report stays final
  manager.disconnect(ROOM, 1);
  manager.disconnect(ROOM, 2);
  const final = manager.rawState(ROOM);
  assert.notDeepEqual(store.loadArchive('test/g1#1')?.state, final); // still the game as first finished
  t.mock.timers.tick(EMPTY_ROOM_TIMEOUT_MS);
  const archived = store.loadArchive('test/g1#1');
  assert.equal(archived?.timeline.length, 3);
  assert.deepEqual(archived?.state, { ...final, rematchVote: null, dismissVote: null });
});

// Who may open a game's history and file
const DEVICE = 'device-0123456789-abcdef';


function finishedWith(store: GameStore, deviceId?: string): Manager {
  const manager = restart(store);
  manager.join('test', 'g1', 'A', undefined, undefined, undefined, deviceId);
  manager.join('test', 'g1', 'B');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  ok(manager.move(ROOM, 1, tick));
  return manager;
}

test('history and the game file need a credential', () => {
  const manager = wonGame();
  for (const credential of [undefined, '', 'wrong', DEVICE]) {
    assert.deepEqual(manager.history('test', 'g1', credential), GONE);
    assert.deepEqual(manager.gameFile('test', 'g1', credential, new Date()), GONE);
  }
  assert.deepEqual(manager.history('test', 'nope', seatKeyOf(manager)), GONE);
  assert.deepEqual(manager.gameFile('chess', 'g1', seatKeyOf(manager), new Date()), GONE);
});

test('a seat key opens the live history and file', () => {
  const manager = wonGame();
  const key = seatKeyOf(manager, 2);
  const history = manager.history('test', 'g1', key);
  assert.ok('steps' in history && history.steps.length === 4);
  const file = manager.gameFile('test', 'g1', key, new Date());
  assert.ok('file' in file && file.file.steps.length === 4);
  const running = gameWith('A', 'B');
  assert.deepEqual(running.gameFile('test', 'g1', seatKeyOf(running), new Date(0)), { error: 'The game is not over yet' });
});

test('a device ID opens the archived game after the room is gone', () => {
  const store = memoryStore();
  finishedWith(store, DEVICE);
  store.remove(ROOM);
  const back = restart(store);
  assert.equal(back.rawState(ROOM), undefined);
  const history = back.history('test', 'g1', DEVICE, 1);
  assert.ok('steps' in history && history.steps.length === 4);
  assert.ok('file' in back.gameFile('test', 'g1', DEVICE, new Date(), 1));
  assert.deepEqual(back.history('test', 'g1', DEVICE, 2), GONE);
  assert.deepEqual(back.history('test', 'g1', 'other-device-0123456789', 1), GONE);
  assert.deepEqual(back.history('test', 'g1', DEVICE), GONE); // the live room is gone too
});

test('a raw device ID reaches no view, history or file, and its hash is the result player deviceId', () => {
  const results: GameResult[] = [];
  const manager = rememberingKeys(createGameManager([testGame], seededRandom, undefined, { onGameFinished: r => results.push(r) }), keys);
  manager.join('test', 'g1', 'A', undefined, undefined, undefined, DEVICE);
  manager.join('test', 'g1', 'B', undefined, undefined, undefined, 'not valid');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  ok(manager.move(ROOM, 1, tick));
  assert.deepEqual(Object.keys(manager.rawState(ROOM)?.seatDevices ?? {}), ['1']);
  const hash = manager.rawState(ROOM)?.seatDevices?.[1] as string;
  const key = seatKeyOf(manager);
  const text = JSON.stringify([
    manager.getState(ROOM, 1), manager.getState(ROOM, null), manager.history('test', 'g1', key), manager.gameFile('test', 'g1', key, new Date())
  ]);
  for (const secret of [DEVICE, hash, 'seatDevices', key, seatKeyOf(manager, 2)]) assert.ok(!text.includes(secret), secret);
  assert.deepEqual(results[0].players, [{ seat: 1, name: 'A', deviceId: hash }, { seat: 2, name: 'B' }]);
});

test('a rejoin records the device too', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 1);
  joined(manager.join('test', 'g1', 'A', true, undefined, undefined, DEVICE));
  assert.deepEqual(Object.keys(manager.rawState(ROOM)?.seatDevices ?? {}), ['1']);
});

test('an undo keeps a device recorded on a rejoin', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 1);
  joined(manager.join('test', 'g1', 'A', true, undefined, undefined, DEVICE));
  ok(manager.requestUndo(ROOM, 1));
  assert.equal(ok(manager.voteUndo(ROOM, 2, true)).moveCount, 0);
  assert.deepEqual(Object.keys(manager.rawState(ROOM)?.seatDevices ?? {}), ['1']);
});

test('a pass-and-play device records its one hash on every local seat, also on a rejoin', () => {
  const manager = createGameManager([testGame], seededRandom);
  const first = seatedLocally(manager.joinLocal('test', 'g1', ['Ann', 'Bo'], undefined, undefined, DEVICE));
  const devices = manager.rawState(ROOM)?.seatDevices ?? {};
  assert.deepEqual(Object.keys(devices), ['1', '2']);
  assert.equal(devices[1], devices[2]);
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 1);
  manager.disconnect(ROOM, 2);
  manager.join('test', 'g1', 'Cy'); // refused once started, so nobody new is recorded
  const keys = first.seats.map(({ seatKey }) => seatKey);
  seatedLocally(manager.joinLocal('test', 'g1', ['Ann', 'Bo'], true, keys, 'other-device-0123456789'));
  const back = manager.rawState(ROOM)?.seatDevices ?? {};
  assert.deepEqual(Object.keys(back), ['1', '2']);
  assert.notEqual(back[1], devices[1]);
  assert.equal(back[1], back[2]);
});

test('a spectator or table screen device is never recorded', () => {
  const manager = gameWith('A', 'B');
  joined(manager.join('test', 'g1', 'Sam', undefined, undefined, 'spectator', DEVICE));
  joined(manager.join('test', 'g1', '', undefined, undefined, 'tableScreen', 'other-device-0123456789'));
  assert.equal(manager.rawState(ROOM)?.seatDevices, undefined);
});

// A game that ends itself in onPlayerLeft, as Hearts or a broken partnership does
const endsOnLeave: AnyGame = { ...testGame, onPlayerLeft: (state: TestState) => ({ ...state, isGameOver: true, currentPlayer: null, winners: [1] }) };

test('a dismissal that ends the game is abandoned even with two players left', () => {
  const table = reporting(undefined, endsOnLeave);
  for (const name of ['A', 'B', 'C']) table.manager.join('test', 'g1', name);
  ok(table.manager.move(ROOM, 1, tick));
  table.manager.disconnect(ROOM, 3);
  ok(table.manager.requestDismiss(ROOM, 1, 3));
  assert.equal(ok(table.manager.voteDismiss(ROOM, 2, true)).isGameOver, true);
  assert.equal(table.results.length, 1);
  assert.equal(table.results[0].abandoned, true);
  assert.equal(table.results[0].players.length, 2);

  // The next game of the room is not marked by the last one's dismissal
  const won = reportingTable();
  playToWin(won);
  assert.equal('abandoned' in won.results[0], false);
});

test('with a samePerson hook, a linked device opens the archived game', () => {
  const store = memoryStore();
  finishedWith(store, DEVICE);
  store.remove(ROOM);
  const linked = 'linked-device-0123456789';
  const back = rememberingKeys(createGameManager([testGame], seededRandom, store, {
    samePerson: (hash, hashes) => hashes.length > 0 && hash === hashDeviceId(linked)
  }), keys);
  assert.ok('steps' in back.history('test', 'g1', linked, 1));
  assert.ok('file' in back.gameFile('test', 'g1', linked, new Date(), 1));
  assert.deepEqual(back.history('test', 'g1', 'stranger-device-0123456789', 1), GONE);
});

test('an archive past 90 days is not available, even to someone who was in the game', () => {
  const store = memoryStore();
  const clock = { now: 1000 };
  const manager = rememberingKeys(createGameManager([testGame], seededRandom, store, { now: () => clock.now }), keys);
  manager.join('test', 'g1', 'A', undefined, undefined, undefined, DEVICE);
  manager.join('test', 'g1', 'B');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  ok(manager.move(ROOM, 1, tick));
  const finishedAt = store.loadArchive('test/g1#1')?.finishedAt as number;
  clock.now = finishedAt + ARCHIVE_TTL_MS - 1;
  assert.ok('steps' in manager.history('test', 'g1', DEVICE, 1));
  clock.now = finishedAt + ARCHIVE_TTL_MS; // finishedAt is now - ARCHIVE_TTL_MS
  for (const credential of [DEVICE, seatKeyOf(manager)]) {
    assert.deepEqual(manager.history('test', 'g1', credential, 1), GONE);
    assert.deepEqual(manager.gameFile('test', 'g1', credential, new Date(), 1), GONE);
  }
});

test('a store that cannot number the game does not stop a join', () => {
  const store = { ...memoryStore(), nextGameNumber: () => { throw new Error('disk'); } };
  const manager = rememberingKeys(createGameManager([testGame], seededRandom, store), keys);
  assert.equal(joined(manager.join('test', 'g1', 'A')).state.gameNumber, 1);
});

// Rematch: a manager that remembers every reseat it reported, and a table that has finished a game
function rematchManager(store: GameStore = memoryStore(), game: AnyGame = rulesGame) {
  const reseats: Reseat[][] = [];
  const manager = rememberingKeys(
    createGameManager([game], seededRandom, store, { reseated: (_roomId, moves) => reseats.push(moves) }), keys
  );
  return { manager, reseats };
}

function playOut(manager: Manager): void {
  agreeAll(manager, ROOM);
  while (!manager.rawState(ROOM)?.isGameOver) ok(manager.move(ROOM, manager.rawState(ROOM)?.currentPlayer as Seat, tick));
}

function finishedRematch(names = ['A', 'B', 'C'], store?: GameStore) {
  const table = rematchManager(store);
  for (const name of names) joined(table.manager.join('test', 'g1', name));
  playOut(table.manager);
  return table;
}

const seatsAndNames = (state: BaseGameState) => state.activePlayers.map(seat => [seat, state.playerNames[seat]]);

test('Rematch needs a finished game and no other vote', () => {
  const running = rematchManager().manager;
  joined(running.join('test', 'g1', 'A'));
  joined(running.join('test', 'g1', 'B'));
  assert.deepEqual(running.requestRematch(ROOM, 1), { error: 'The game is not over yet' });

  const { manager } = finishedRematch();
  ok(manager.requestUndo(ROOM, 1));
  assert.deepEqual(manager.requestRematch(ROOM, 2), { error: 'A vote is already in progress' });
  ok(manager.voteUndo(ROOM, 2, false));
  manager.disconnect(ROOM, 3);
  ok(manager.requestDismiss(ROOM, 1, 3));
  assert.deepEqual(manager.requestRematch(ROOM, 2), { error: 'A vote is already in progress' });
  ok(manager.voteDismiss(ROOM, 2, false));
  ok(manager.requestRematch(ROOM, 1));
  assert.deepEqual(manager.requestRematch(ROOM, 2), { error: 'A rematch vote is already in progress' });
  assert.deepEqual(manager.voteRematch(ROOM, 2, 'yes'), { error: 'Invalid vote' });
  assert.deepEqual(manager.voteRematch(ROOM, 1, true), { error: 'You already voted' });
  assert.deepEqual(finishedRematch().manager.voteRematch(ROOM, 2, true), { error: 'No rematch vote in progress' });
});

test('the requester counts as Join', () => {
  const { manager } = finishedRematch();
  const state = ok(manager.requestRematch(ROOM, 2));
  assert.deepEqual(state.rematchVote, { requestedBy: 2, votes: { 2: true } });
  assert.equal(state.gameStatus, 'B wants a rematch');
});

test('everyone joining resets the room into a lobby at the same ID', () => {
  const { manager, reseats } = finishedRematch();
  const before = manager.rawState(ROOM) as BaseGameState;
  ok(manager.requestRematch(ROOM, 1));
  ok(manager.voteRematch(ROOM, 2, true));
  assert.equal(reseats.length, 0);
  ok(manager.voteRematch(ROOM, 3, true));
  const state = manager.rawState(ROOM) as BaseGameState;
  assert.equal(state.started, false);
  assert.equal(state.isGameOver, false);
  assert.equal(state.gameNumber, 2);
  assert.equal(state.rematchVote ?? null, null);
  assert.deepEqual(seatsAndNames(state), [[1, 'A'], [2, 'B'], [3, 'C']]);
  assert.deepEqual(state.seatKeys, before.seatKeys);
  assert.deepEqual(reseats, [[1, 2, 3].map(seat => ({ from: seat, to: seat, seatKey: before.seatKeys?.[seat] }))]);
  agreeAll(manager, ROOM);
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 2);
  assert.equal(joined(manager.join('test', 'g1', 'B', true, before.seatKeys?.[2])).seat, 2);
});

test('drops leave and the joiners are seated from 1', () => {
  const { manager, reseats } = finishedRematch();
  const keysBefore = manager.rawState(ROOM)?.seatKeys as Record<Seat, string>;
  ok(manager.requestRematch(ROOM, 2));
  ok(manager.voteRematch(ROOM, 1, false));
  ok(manager.voteRematch(ROOM, 3, true));
  const state = manager.rawState(ROOM) as BaseGameState;
  assert.deepEqual(seatsAndNames(state), [[1, 'B'], [2, 'C']]);
  assert.deepEqual(state.seatKeys, { 1: keysBefore[2], 2: keysBefore[3] });
  assert.deepEqual(reseats[0], [
    { from: 1, to: null, seatKey: keysBefore[1] }, { from: 2, to: 1, seatKey: keysBefore[2] }, { from: 3, to: 2, seatKey: keysBefore[3] }
  ]);
});

test('fewer joiners than the game needs still open the lobby', () => {
  const { manager } = finishedRematch(['A', 'B']);
  ok(manager.requestRematch(ROOM, 1));
  ok(manager.voteRematch(ROOM, 2, false));
  const state = manager.rawState(ROOM) as BaseGameState;
  assert.deepEqual(seatsAndNames(state), [[1, 'A']]);
  assert.equal(state.started, false);
});

test("last game's house rules are the proposal and need agreeing again", () => {
  const { manager } = rematchManager();
  for (const name of ['A', 'B', 'C']) joined(manager.join('test', 'g1', name));
  ok(manager.setHouseRules(ROOM, 1, { values: { fast: true, goal: 5, big: true, bigger: false }, maxPlayers: 3 }));
  playOut(manager);
  const before = manager.rawState(ROOM)?.houseRules;
  ok(manager.requestRematch(ROOM, 1));
  ok(manager.voteRematch(ROOM, 2, true));
  ok(manager.voteRematch(ROOM, 3, true));
  const rules = manager.rawState(ROOM)?.houseRules;
  assert.deepEqual(rules?.values, before?.values);
  assert.equal(rules?.maxPlayers, 3);
  assert.deepEqual(rules?.agreed, []);
  assert.equal(rules?.revision, (before?.revision as number) + 1);
  assert.deepEqual(manager.move(ROOM, 1, tick), { error: 'Everyone must agree to the house rules first' });
});

test('spectators stay and their permissions start fresh', () => {
  const { manager } = rematchManager(memoryStore(), handGame);
  joined(manager.join('test', 'g1', 'A'));
  joined(manager.join('test', 'g1', 'B'));
  ok(manager.move(ROOM, 1, tick));
  const dana = joined(manager.join('test', 'g1', 'Dana', false, undefined, 'spectator')).spectatorId as string;
  ok(manager.requestHand(ROOM, dana, 2));
  ok(manager.answerHand(ROOM, 2, dana, true));
  ok(manager.requestHand(ROOM, dana, 1));
  ok(manager.move(ROOM, 2, tick));
  ok(manager.move(ROOM, 1, tick));
  manager.disconnectSpectator(ROOM, dana); // a started game keeps the entry, so Dana can come back with the key
  ok(manager.requestRematch(ROOM, 1));
  ok(manager.voteRematch(ROOM, 2, true));
  const state = manager.rawState(ROOM) as BaseGameState;
  assert.equal(state.started, false);
  assert.deepEqual(state.spectators?.map(s => [s.id, s.allowedSeats]), [[dana, []]]);
  assert.deepEqual(state.handRequests, []);
  assert.equal(joined(manager.join('test', 'g1', 'Dana', true, undefined, 'spectator')).spectatorId, dana);
});

test('a non-responder can be dismissed and counts as Drop', () => {
  const store = memoryStore();
  const { manager } = finishedRematch(['A', 'B', 'C'], store);
  ok(manager.requestRematch(ROOM, 1));
  ok(manager.voteRematch(ROOM, 2, true));
  assert.deepEqual(manager.requestDismiss(ROOM, 1, 1), { error: 'That player already answered' });
  assert.deepEqual(manager.requestDismiss(ROOM, 1, 2), { error: 'That player already answered' });
  ok(manager.requestDismiss(ROOM, 1, 3));
  assert.deepEqual(manager.rawState(ROOM)?.activePlayers, [1, 2, 3]); // C is connected and not yet dismissed
  assert.deepEqual(manager.voteDismiss(ROOM, 3, false), { error: 'You cannot vote on your own dismissal' });
  ok(manager.voteDismiss(ROOM, 2, true));
  const state = manager.rawState(ROOM) as BaseGameState;
  assert.deepEqual(seatsAndNames(state), [[1, 'A'], [2, 'B']]);
  const archived = store.loadArchive('test/g1#1')?.state;
  assert.deepEqual(archived?.activePlayers, [1, 2, 3]);
  assert.equal(archived?.rematchVote, null); // the game as it ended, without the votes that followed
  assert.equal(archived?.dismissVote, null);
  const old = manager.history('test', 'g1', state.seatKeys?.[1], 1);
  assert.ok('steps' in old);
  assert.deepEqual(old.steps.at(-1)?.standings?.map(standing => standing.seat).sort(), [1, 2, 3]);
});

test('a dismiss of a disconnected non-responder during a rematch vote removes no seat', () => {
  const { manager } = finishedRematch();
  ok(manager.requestRematch(ROOM, 1));
  manager.disconnect(ROOM, 3);
  ok(manager.requestDismiss(ROOM, 1, 3));
  ok(manager.voteDismiss(ROOM, 2, true));
  const state = manager.rawState(ROOM) as BaseGameState;
  assert.deepEqual(state.rematchVote?.votes, { 1: true, 3: false });
  assert.deepEqual(state.activePlayers, [1, 2, 3]);
  assert.equal(state.isGameOver, true);
});

test('a reseated hook that throws does not stop the reset', (t: TestContext) => {
  t.mock.method(console, 'error', () => {});
  const manager = rememberingKeys(createGameManager([testGame], seededRandom, undefined, { reseated: () => { throw new Error('socket'); } }), keys);
  joined(manager.join('test', 'g1', 'A'));
  joined(manager.join('test', 'g1', 'B'));
  playOut(manager);
  ok(manager.requestRematch(ROOM, 1));
  ok(manager.voteRematch(ROOM, 2, true));
  assert.equal(manager.rawState(ROOM)?.gameNumber, 2);
});

test('answering ends the dismiss vote against you', () => {
  const { manager } = finishedRematch();
  ok(manager.requestRematch(ROOM, 1));
  ok(manager.requestDismiss(ROOM, 1, 3));
  ok(manager.voteRematch(ROOM, 3, true));
  const state = manager.rawState(ROOM) as BaseGameState;
  assert.equal(state.dismissVote, null);
  assert.deepEqual(state.rematchVote?.votes, { 1: true, 3: true });
});

test('a disconnected joiner is left out', () => {
  const { manager, reseats } = finishedRematch();
  ok(manager.requestRematch(ROOM, 1));
  ok(manager.voteRematch(ROOM, 2, true));
  manager.disconnect(ROOM, 2);
  ok(manager.voteRematch(ROOM, 3, true));
  const state = manager.rawState(ROOM) as BaseGameState;
  assert.deepEqual(seatsAndNames(state), [[1, 'A'], [2, 'C']]);
  assert.equal(state.gameStatus, 'B was not connected and was left out');
  assert.equal(reseats[0][1].to, null);
});

test('everyone dropping lets Rematch be pressed again', () => {
  const { manager, reseats } = finishedRematch();
  ok(manager.requestRematch(ROOM, 1));
  manager.disconnect(ROOM, 1);
  ok(manager.voteRematch(ROOM, 2, false));
  ok(manager.voteRematch(ROOM, 3, false));
  const state = manager.rawState(ROOM) as BaseGameState;
  assert.equal(state.rematchVote, null);
  assert.equal(state.gameStatus, 'Nobody joined the rematch');
  assert.equal(state.isGameOver, true);
  assert.equal(reseats.length, 0);
  ok(manager.requestRematch(ROOM, 2));
});

test('the last joiner disconnecting with every seat answered settles as Nobody joined', () => {
  const { manager } = finishedRematch();
  ok(manager.requestRematch(ROOM, 1));
  ok(manager.voteRematch(ROOM, 2, false));
  manager.disconnect(ROOM, 1);
  manager.disconnect(ROOM, 3);
  ok(manager.requestDismiss(ROOM, 2, 3)); // B is the only voter, so the dismiss passes at once
  assert.equal(manager.rawState(ROOM)?.gameStatus, 'Nobody joined the rematch');
});

test('undo is refused during a rematch vote', () => {
  const { manager } = finishedRematch();
  ok(manager.requestRematch(ROOM, 1));
  assert.deepEqual(manager.requestUndo(ROOM, 2), { error: 'A rematch vote is in progress' });
});

test('a restart mid-vote clears the vote and keeps the archive', () => {
  const store = memoryStore();
  const { manager } = finishedRematch(['A', 'B', 'C'], store);
  ok(manager.requestRematch(ROOM, 1));
  const back = rematchManager(store).manager;
  assert.equal(back.rawState(ROOM)?.rematchVote, null);
  assert.ok(store.loadArchive('test/g1#1'));
  ok(back.requestRematch(ROOM, 1));
});

test('a room saved before this change, with no gameNumber or rematchVote, loads and can rematch', () => {
  const store = memoryStore();
  finishedRematch(['A', 'B'], store);
  const { gameNumber: _n, rematchVote: _v, ...old } = saved(store).state;
  store.save(ROOM, 'test', old as BaseGameState);
  const { manager } = rematchManager(store);
  joined(manager.join('test', 'g1', 'A', true));
  joined(manager.join('test', 'g1', 'B', true));
  ok(manager.requestRematch(ROOM, 1));
  ok(manager.voteRematch(ROOM, 2, true));
  assert.equal(manager.rawState(ROOM)?.gameNumber, 2);
});

test('the finished game stays in history after the reset', () => {
  const { manager } = finishedRematch(['A', 'B']);
  const key = seatKeyOf(manager);
  ok(manager.requestRematch(ROOM, 1));
  ok(manager.voteRematch(ROOM, 2, true));
  const old = manager.history('test', 'g1', key, 1);
  assert.ok('steps' in old);
  assert.equal(old.steps.length, 4);
  assert.equal(old.steps.at(-1)?.isGameOver, true);
  const now = manager.history('test', 'g1', key);
  assert.ok('steps' in now);
  assert.deepEqual(now.steps.map(step => [step.historyStep, step.started]), [['start', false]]);
});

test('live views name the seats the table waits on, history steps do not', () => {
  const manager = gameWith('Ann', 'Bob');
  assert.deepEqual(manager.getState(ROOM, 1)?.waitingOn, [1]);
  const steps = manager.history('test', 'g1', seatKeyOf(manager));
  assert.ok('steps' in steps);
  assert.equal('waitingOn' in steps.steps[0], false);
});

function seatedLocally(result: ReturnType<Manager['joinLocal']>) {
  if ('error' in result) assert.fail(result.error);
  return result;
}

test('joinLocal seats every name on one device, each with its own key', () => {
  const manager = createGameManager([testGame], seededRandom);
  const result = seatedLocally(manager.joinLocal('test', 'g1', [' Ann ', 'Bo']));
  assert.equal(result.roomId, ROOM);
  assert.deepEqual(result.seats.map(({ seat }) => seat), [1, 2]);
  assert.notEqual(result.seats[0].seatKey, result.seats[1].seatKey);
  assert.deepEqual(result.state.playerNames, { 1: 'Ann', 2: 'Bo' });
  assert.equal((result.state as TestPublicState).viewer, null);
  assert.equal(joined(manager.join('test', 'g1', 'Cy')).seat, 3); // a remote player mixes in
});

test('joinLocal is all or nothing', () => {
  const manager = createGameManager([testGame], seededRandom);
  assert.deepEqual(manager.joinLocal('test', 'g1', ['Ann', 'ann']), { error: 'Each player needs a different name' });
  assert.equal(manager.getState(ROOM), undefined);
  assert.deepEqual(manager.joinLocal('test', 'g1', ['Ann']), { error: 'Enter at least two names' });
  assert.deepEqual(manager.joinLocal('test', 'g1', 'Ann'), { error: 'Enter at least two names' });
  manager.join('test', 'g1', 'Cy');
  manager.join('test', 'g1', 'Dee');
  assert.deepEqual(manager.joinLocal('test', 'g1', ['Ann', 'Bo', 'Eve']), { error: 'Only 2 seats left in this game' });
  assert.deepEqual(current(manager).activePlayers, [1, 2]);
  assert.deepEqual(manager.joinLocal('test', 'g1', ['Ann', 'Cy']), { error: 'Cy is already in this game' });
  assert.deepEqual(current(manager).activePlayers, [1, 2]);
  manager.join('test', 'g1', 'Fay');
  assert.deepEqual(manager.joinLocal('test', 'g1', ['Ann', 'Bo']), { error: 'Only 1 seat left in this game' });
});

test('joinLocal is refused for a game that cannot be shared', () => {
  const secretive = { ...testGame, info: { ...testGame.info, passAndPlay: false } };
  const manager = createGameManager([secretive], seededRandom);
  assert.deepEqual(manager.joinLocal('test', 'g1', ['Ann', 'Bo']), { error: 'Pass and play is not offered for Test' });
});

test('a pass-and-play rejoin takes back each seat whose key matches', () => {
  const both = createGameManager([testGame], seededRandom);
  const [ann, bo] = seatedLocally(both.joinLocal('test', 'g1', ['Ann', 'Bo'])).seats;
  ok(both.move(ROOM, 1, tick));
  both.disconnect(ROOM, 1);
  both.disconnect(ROOM, 2);
  const back = seatedLocally(both.joinLocal('test', 'g1', ['Ann', 'Bo'], true, [ann.seatKey, bo.seatKey]));
  assert.deepEqual(back.seats, [ann, bo]);
  assert.deepEqual(current(both).disconnected, []);

  const one = createGameManager([testGame], seededRandom);
  const [keyA] = seatedLocally(one.joinLocal('test', 'g1', ['Ann', 'Bo'])).seats;
  ok(one.move(ROOM, 1, tick));
  one.disconnect(ROOM, 1);
  one.disconnect(ROOM, 2);
  assert.deepEqual(seatedLocally(one.joinLocal('test', 'g1', ['Ann', 'Bo'], true, [keyA.seatKey, 'wrong'])).seats, [keyA]);
  assert.deepEqual(current(one).disconnected, [2]);
  assert.deepEqual(one.joinLocal('test', 'g1', ['Ann', 'Bo'], true, ['x', 'y']), { error: 'Ann is already in this game' });
  assert.deepEqual(one.joinLocal('test', 'nope', ['Ann', 'Bo'], true, []), { error: 'Game not found' });
});

test('handoffSeat hides a private hand between local turns, and skips the handoff when nothing is private', () => {
  for (const [game, expected] of [[handGame, null], [testGame, 2]] as const) {
    const manager = createGameManager([game], seededRandom);
    seatedLocally(manager.joinLocal('test', 'g1', ['Ann', 'Bo']));
    assert.equal(manager.handoffSeat(ROOM, 1, [1, 2]), 1);
    ok(manager.move(ROOM, 1, tick));
    assert.equal(manager.handoffSeat(ROOM, 1, [1, 2]), expected);
  }
});

test('handoffSeat stops showing a local seat that was dismissed', () => {
  const manager = createGameManager([testGame], seededRandom);
  seatedLocally(manager.joinLocal('test', 'g1', ['Ann', 'Bo']));
  manager.join('test', 'g1', 'Cy');
  ok(manager.move(ROOM, 1, tick));
  manager.disconnect(ROOM, 3);
  ok(manager.requestDismiss(ROOM, 1, 3));
  ok(manager.voteDismiss(ROOM, 2, true));
  assert.notEqual(manager.handoffSeat(ROOM, 3, [1, 2, 3]), 3);
  assert.equal(manager.handoffSeat(ROOM, 3, [3]), null);
});

test('an unanswered hand request does not keep a local seat shown once the turn moves on', () => {
  const manager = createGameManager([handGame], seededRandom);
  seatedLocally(manager.joinLocal('test', 'g1', ['Ann', 'Bo']));
  ok(manager.move(ROOM, 1, tick));
  const spectator = manager.join('test', 'g1', 'Dana', false, undefined, 'spectator');
  assert.ok('spectatorId' in spectator && spectator.spectatorId);
  ok(manager.requestHand(ROOM, spectator.spectatorId, 2));
  assert.equal(manager.handoffSeat(ROOM, 2, [1, 2]), 2);
  ok(manager.move(ROOM, 2, tick));
  assert.equal(manager.handoffSeat(ROOM, 2, [1, 2]), null);
});

test('a pass-and-play view holds no local seat\'s hand but the shown one', () => {
  const manager = createGameManager([handGame], seededRandom);
  const { state } = seatedLocally(manager.joinLocal('test', 'g1', ['Ann', 'Bo']));
  for (const view of [state, manager.getState(ROOM, manager.handoffSeat(ROOM, null, [1, 2]))]) {
    assert.doesNotMatch(JSON.stringify(view), /card1|card2/);
  }
  const shown = JSON.stringify(manager.getState(ROOM, manager.handoffSeat(ROOM, 1, [1, 2])));
  assert.match(shown, /card1/);
  assert.doesNotMatch(shown, /card2/);
});
