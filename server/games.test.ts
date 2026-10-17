import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from './games.ts';
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

function left(result: ReturnType<Manager['leave']>): TestPublicState {
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
  const afterLeave = left(gameWith('A', 'B', 'C').leave(ROOM, 3));
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

test('leaving the lobby frees the seat and the last one out deletes the game', () => {
  const manager = gameWith('A', 'B');
  assert.deepEqual(left(manager.leave(ROOM, 1)).activePlayers, [2]);
  assert.equal(joined(manager.join('test', 'g1', 'C')).seat, 1);
  manager.leave(ROOM, 1);
  assert.equal(manager.leave(ROOM, 2), null);
  assert.equal(manager.getState(ROOM), undefined);
  assert.equal(manager.leave(ROOM, 2), null);
});

test('leaving mid-game hands the win to the last player', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, tick));
  const state = left(manager.leave(ROOM, 2));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
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

test('a player leaving during a vote no longer counts', () => {
  const manager = gameWith('A', 'B', 'C');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  const after = left(manager.leave(ROOM, 3));
  assert.equal(after.undoVote, null);
  assert.equal(after.moves, 0);
  assert.deepEqual(after.activePlayers, [1, 2]);
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

test('an undo returning the turn to a departed player skips them', () => {
  const manager = gameWith('A', 'B', 'C');
  ok(manager.move(ROOM, 1, tick));
  ok(manager.move(ROOM, 2, tick));
  manager.leave(ROOM, 2);
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

test('an undo vote after a win is canceled when the winner leaves', () => {
  const manager = wonGame();
  ok(manager.requestUndo(ROOM, 2));
  const state = left(manager.leave(ROOM, 1));
  assert.equal(state.undoVote, null);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.deepEqual(manager.voteUndo(ROOM, 2, true), { error: 'No undo vote in progress' });
});

test('an undo vote after a win is canceled when the requester leaves', () => {
  const manager = wonGame();
  ok(manager.requestUndo(ROOM, 2));
  const state = left(manager.leave(ROOM, 2));
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
