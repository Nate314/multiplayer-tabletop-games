import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPlayer, removePlayer, nextActivePlayer, applyMove, baseGameState } from './seating.ts';
import { testGame, type TestState } from './testGame.ts';

function join(state: TestState, ...names: string[]): TestState {
  let current = state;
  for (const name of names) {
    const result = addPlayer(testGame, current, name);
    if ('error' in result) throw new Error(result.error);
    current = result.state;
  }
  return current;
}

function move(state: TestState, seat: number): TestState {
  const result = applyMove(testGame, state, seat, { type: 'tick' });
  if ('error' in result) throw new Error(result.error);
  return result.state;
}

test('nextActivePlayer wraps and skips missing seats', () => {
  assert.equal(nextActivePlayer({ activePlayers: [1, 3, 4] }, 4), 1);
  assert.equal(nextActivePlayer({ activePlayers: [1, 3, 4] }, 1), 3);
  assert.equal(nextActivePlayer({ activePlayers: [] }, 1), null);
});

test('seats fill the lowest free seat and the lobby resets', () => {
  let state = join(testGame.createGameState('g'), 'A', 'B', 'C');
  state = removePlayer(testGame, state, 2);
  assert.deepEqual(state.activePlayers, [1, 3]);
  assert.equal(state.playerNames[2], undefined);
  const result = addPlayer(testGame, state, 'D');
  assert.ok('seat' in result);
  assert.equal(result.seat, 2);
  assert.deepEqual(result.state.activePlayers, [1, 2, 3]);
  assert.equal(result.state.gameStatus, 'D joined (3/4 players)');
  assert.equal(result.state.currentPlayer, 1);
});

test('join is refused when full or started', () => {
  const full = join(testGame.createGameState('g'), 'A', 'B', 'C', 'D');
  assert.deepEqual(addPlayer(testGame, full, 'E'), { error: 'Game is full' });
  const started = move(join(testGame.createGameState('g'), 'A', 'B'), 1);
  assert.deepEqual(addPlayer(testGame, started, 'C'), { error: 'Game already in progress' });
});

test('move guards', () => {
  const alone = join(testGame.createGameState('g'), 'A');
  assert.deepEqual(applyMove(testGame, alone, 1, { type: 'tick' }), { error: 'Waiting for more players' });

  const ready = join(testGame.createGameState('g'), 'A', 'B');
  assert.deepEqual(applyMove(testGame, ready, 2, { type: 'tick' }), { error: 'Not your turn' });

  const voting = { ...ready, undoVote: { requestedBy: 1, votes: {} } };
  assert.deepEqual(applyMove(testGame, voting, 1, { type: 'tick' }), { error: 'An undo vote is in progress' });

  const over = { ...ready, isGameOver: true };
  assert.deepEqual(applyMove(testGame, over, 1, { type: 'tick' }), { error: 'The game is over' });

  assert.equal(ready.started, false);
  assert.equal(move(ready, 1).started, true);
});

test('leaving mid-game passes the turn and keeps the name', () => {
  let state = move(join(testGame.createGameState('g'), 'A', 'B', 'C'), 1);
  state = { ...state, currentPlayer: 1 };
  state = removePlayer(testGame, state, 1);
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.activePlayers, [2, 3]);
  assert.equal(state.playerNames[1], 'A');
  assert.equal(state.gameStatus, 'A left the game');
});

test('the last player left wins', () => {
  let state = move(join(testGame.createGameState('g'), 'A', 'B'), 1);
  state = removePlayer(testGame, state, 2);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.currentPlayer, null);
  assert.equal(state.isGameOver, true);
  assert.equal(state.gameStatus, 'A wins! Everyone else left.');
});

test('baseGameState starts empty', () => {
  assert.deepEqual(baseGameState('g'), {
    gameId: 'g',
    started: false,
    currentPlayer: null,
    activePlayers: [],
    playerNames: {},
    gameStatus: '',
    isGameOver: false,
    winners: [],
    undoVote: null
  });
});
