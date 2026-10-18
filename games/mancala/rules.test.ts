import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialBoard, oppositePit, pitsOf, sow, storeOf } from './rules.ts';
import { mancala } from './index.ts';
import { addPlayer, removePlayer, applyMove } from '../../shared/seating.ts';
import type { Board, GameState, Seat } from './types.ts';

// Seat 1's pits 0-5 and store, then seat 2's pits 7-12 and store
function board(one: number[], oneStore: number, two: number[], twoStore: number): Board {
  return [...one, oneStore, ...two, twoStore];
}

function seated(result: ReturnType<typeof addPlayer<GameState>>) {
  if ('error' in result) assert.fail(result.error);
  return result;
}

function lobby(...names: string[]): GameState {
  let state = mancala.createGameState('g1');
  for (const name of names) state = seated(addPlayer(mancala, state, name)).state;
  return state;
}

function play(state: GameState, seat: Seat, pit: number): GameState {
  const result = applyMove(mancala, state, seat, { pit });
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

test('the board starts with four seeds in each pit and empty stores', () => {
  assert.deepEqual(initialBoard(), board([4, 4, 4, 4, 4, 4], 0, [4, 4, 4, 4, 4, 4], 0));
  assert.deepEqual(pitsOf(1), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(pitsOf(2), [7, 8, 9, 10, 11, 12]);
  assert.equal(storeOf(1), 6);
  assert.equal(storeOf(2), 13);
  assert.equal(oppositePit(0), 12);
  assert.equal(oppositePit(10), 2);
});

test('sowing goes one seed per hole and skips the opponent store', () => {
  assert.deepEqual(sow(initialBoard(), 1, 0), { board: board([0, 5, 5, 5, 5, 4], 0, [4, 4, 4, 4, 4, 4], 0), end: 4 });
  const long = board([0, 0, 0, 0, 0, 10], 0, [0, 0, 0, 0, 0, 0], 0);
  assert.deepEqual(sow(long, 1, 5), { board: board([1, 1, 1, 0, 0, 0], 1, [1, 1, 1, 1, 1, 1], 0), end: 2 });
  const forTwo = board([0, 0, 0, 0, 0, 0], 0, [0, 0, 0, 0, 0, 9], 0);
  assert.deepEqual(sow(forTwo, 2, 12), { board: board([1, 1, 1, 1, 1, 1], 0, [1, 1, 0, 0, 0, 0], 1), end: 8 });
});

test('players take seats in order and a third is refused', () => {
  const state = lobby('A', 'B');
  assert.deepEqual(state.activePlayers, [1, 2]);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.gameStatus, 'B joined (2/2 players)');
  assert.deepEqual(addPlayer(mancala, state, 'C'), { error: 'Game is full' });
});

test('rejects malformed and illegal moves', () => {
  const state = lobby('A', 'B');
  assert.deepEqual(applyMove(mancala, state, 2, { pit: 7 }), { error: 'Not your turn' });
  assert.deepEqual(applyMove(mancala, lobby('A'), 1, { pit: 0 }), { error: 'Waiting for more players' });
  for (const move of [{ pit: 7 }, { pit: 6 }, { pit: -1 }, { pit: '0' }, { pit: 0.5 }, {}, null, 'pit', []]) {
    assert.deepEqual(applyMove(mancala, state, 1, move), { error: 'Invalid move' });
  }
  const empty = { ...state, board: board([0, 4, 4, 4, 4, 4], 0, [4, 4, 4, 4, 4, 4], 0) };
  assert.deepEqual(applyMove(mancala, empty, 1, { pit: 0 }), { error: 'Invalid move' });
});

test('a plain move passes the turn and records the last move', () => {
  const state = play(lobby('A', 'B'), 1, 0);
  assert.deepEqual(state.board, board([0, 5, 5, 5, 5, 4], 0, [4, 4, 4, 4, 4, 4], 0));
  assert.deepEqual(state.lastMove, { playerNumber: 1, pit: 0, end: 4, sown: 4, captured: 0, extraTurn: false });
  assert.equal(state.gameStatus, 'A sowed 4 seeds');
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.started, true);
  assert.deepEqual(addPlayer(mancala, state, 'C'), { error: 'Game already in progress' });
});

test('the last seed in your own store gives an extra turn', () => {
  const state = play(lobby('A', 'B'), 1, 2);
  assert.equal(state.lastMove?.end, 6);
  assert.equal(state.lastMove?.extraTurn, true);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.gameStatus, 'A gets an extra turn');
  const second = play({ ...state, currentPlayer: 2 }, 2, 9);
  assert.equal(second.lastMove?.end, 13);
  assert.equal(second.currentPlayer, 2);
});

test('the last seed in an empty pit of yours captures the pit across', () => {
  const start = { ...lobby('A', 'B'), board: board([1, 0, 4, 4, 4, 4], 0, [4, 4, 4, 4, 7, 4], 0) };
  const state = play(start, 1, 0);
  assert.deepEqual(state.board, board([0, 0, 4, 4, 4, 4], 8, [4, 4, 4, 4, 0, 4], 0));
  assert.equal(state.lastMove?.captured, 8);
  assert.equal(state.gameStatus, 'A captured 8 seeds');
  assert.equal(state.currentPlayer, 2);
});

test('no capture when the pit across is empty or the empty pit is the opponent\'s', () => {
  const across = { ...lobby('A', 'B'), board: board([1, 0, 4, 4, 4, 4], 0, [4, 4, 4, 4, 0, 4], 0) };
  assert.equal(play(across, 1, 0).lastMove?.captured, 0);
  assert.equal(play(across, 1, 0).board[1], 1);

  const theirs = { ...lobby('A', 'B'), board: board([4, 4, 4, 4, 4, 2], 0, [0, 4, 4, 4, 4, 4], 0) };
  const state = play(theirs, 1, 5);
  assert.equal(state.lastMove?.captured, 0);
  assert.equal(state.board[7], 1);
});

test('seat 2 captures on its own side', () => {
  const start = { ...lobby('A', 'B'), currentPlayer: 2, board: board([4, 4, 4, 5, 4, 4], 0, [4, 1, 0, 4, 4, 4], 0) };
  const state = play(start, 2, 8);
  assert.equal(state.lastMove?.captured, 6);
  assert.equal(state.board[13], 6);
  assert.equal(state.board[2], 4);
  assert.equal(state.board[3], 0);
});

test('when a side empties, the rest go to their owner and the most seeds win', () => {
  const start = { ...lobby('A', 'B'), board: board([0, 0, 0, 0, 0, 1], 20, [1, 2, 0, 0, 0, 0], 24) };
  const state = play(start, 1, 5);
  assert.deepEqual(state.board, board([0, 0, 0, 0, 0, 0], 21, [0, 0, 0, 0, 0, 0], 27));
  assert.equal(state.isGameOver, true);
  assert.equal(state.currentPlayer, null);
  assert.deepEqual(state.winners, [2]);
  assert.equal(state.gameStatus, 'B wins 27 to 21!');
  assert.deepEqual(applyMove(mancala, state, 1, { pit: 0 }), { error: 'The game is over' });
});

test('equal stores are a draw', () => {
  const start = { ...lobby('A', 'B'), board: board([0, 0, 0, 0, 0, 1], 23, [0, 0, 0, 0, 0, 0], 24) };
  const state = play(start, 1, 5);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, []);
  assert.equal(state.gameStatus, 'Draw, 24 seeds each');
});

test('the last connected player wins', () => {
  const state = removePlayer(mancala, play(lobby('A', 'B'), 1, 0), 1);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [2]);
});
