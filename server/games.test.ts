import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager, EMPTY_ROOM_TIMEOUT_MS } from './games.ts';
import { testGame, type TestPublicState } from '../shared/testGame.ts';
import type { Random, Result } from '../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const tick = { type: 'tick' };
const ROOM = 'test/g1';

// Deterministic stand-in for Math.random
const seededRandom: Random = () => 0.5;

function newManager(): Manager {
  return createGameManager([testGame], seededRandom);
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
  const manager = createGameManager([testGame, copy], seededRandom);
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
  assert.deepEqual(current(manager), state);
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

test('an undo vote after a win passes when the only other voter disconnects', () => {
  const manager = wonGame();
  ok(manager.requestUndo(ROOM, 2));
  const state = left(manager.disconnect(ROOM, 1));
  assert.equal(state.undoVote, null);
  assert.equal(state.isGameOver, false);
  assert.deepEqual(state.winners, []);
  assert.equal(state.moves, 2);
  assert.deepEqual(state.disconnected, [1]);
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
  const manager = createGameManager([withoutActions], seededRandom);
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

test('history lists the state after each move, hides secrets, and drops undone moves', () => {
  const manager = gameWith('A', 'B', 'C');
  assert.deepEqual(manager.history('test', 'g1'), []);
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  const last = ok(manager.move(ROOM, 3, tick));
  assert.equal(last.moveCount, 3);

  const steps = manager.history('test', ' g1 ') as TestPublicState[] | null;
  assert.ok(steps);
  assert.deepEqual(steps.map(step => step.moveCount), [1, 2, 3]);
  assert.deepEqual(steps.map(step => step.moves), [1, 2, 3]);
  assert.deepEqual(steps.map(step => step.gameStatus), ['A ticked', 'B ticked', 'C ticked']);
  for (const step of steps) {
    assert.equal('secret' in step, false);
    assert.equal(step.undoAvailable, false);
  }

  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  const undone = ok(manager.voteUndo(ROOM, 3, true));
  assert.equal(undone.moveCount, 2);
  assert.equal(manager.history('test', 'g1')?.length, 2);

  assert.equal(manager.history('chess', 'g1'), null);
  assert.equal(manager.history('test', 'nope'), null);
  assert.equal(manager.history('test', 'a/b'), null);
  assert.equal(manager.history(undefined, undefined), null);
});

test('actions add no history steps', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  const pinged = ok(manager.action(ROOM, 2, { type: 'ping' }));
  assert.equal(pinged.moveCount, 1);
  assert.equal(manager.history('test', 'g1')?.length, 1);
});
