import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankOf, initialBoard, oppositePit, pitsOf, playPit } from './rules.ts';
import { mancala } from './index.ts';
import { addPlayer, removePlayer, applyMove } from '../../shared/seating.ts';
import type { Board, GameState, Seat } from './types.ts';

// Seat 1's pits 0-5 and bank, then seat 2's pits 7-12 and bank, as stone counts.
// Every stone has the color of the side it is on.
function board(one: number[], oneBank: number, two: number[], twoBank: number): Board {
  const holes = (counts: number[], seat: Seat) => counts.map(count => Array<Seat>(count).fill(seat));
  return [...holes([...one, oneBank], 1), ...holes([...two, twoBank], 2)];
}

function counts(holes: Board): number[] {
  return holes.map(hole => hole.length);
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

test('the board starts with four stones of their owner\'s color in each pit and empty banks', () => {
  assert.deepEqual(initialBoard(), board([4, 4, 4, 4, 4, 4], 0, [4, 4, 4, 4, 4, 4], 0));
  assert.deepEqual(pitsOf(1), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(pitsOf(2), [7, 8, 9, 10, 11, 12]);
  assert.equal(bankOf(1), 6);
  assert.equal(bankOf(2), 13);
  assert.equal(oppositePit(0), 12);
  assert.equal(oppositePit(10), 2);
});

test('the picked-up stones go one per hole and skip the opponent bank', () => {
  const first = playPit(initialBoard(), 1, 0);
  assert.deepEqual(counts(first.board), counts(board([0, 5, 5, 5, 5, 4], 0, [4, 4, 4, 4, 4, 4], 0)));
  assert.equal(first.end, 4);
  assert.deepEqual(first.drops.map(({ to }) => to), [1, 2, 3, 4]);

  const long = playPit(board([0, 0, 0, 0, 0, 10], 0, [0, 0, 0, 0, 0, 0], 0), 1, 5);
  assert.deepEqual(long.drops.map(({ to }) => to), [6, 7, 8, 9, 10, 11, 12, 0, 1, 2]);
  assert.equal(long.end, 2);

  const forTwo = playPit(board([0, 0, 0, 0, 0, 0], 0, [0, 0, 0, 0, 0, 9], 0), 2, 12);
  assert.deepEqual(forTwo.drops.map(({ to }) => to), [13, 0, 1, 2, 3, 4, 5, 7, 8]);
  assert.equal(forTwo.end, 8);
});

test('stones keep their color as they move', () => {
  const { board: after } = playPit(initialBoard(), 1, 5);
  assert.deepEqual(after[6], [1]);
  assert.deepEqual(after[7], [2, 2, 2, 2, 1]);
  assert.deepEqual(after[9], [2, 2, 2, 2, 1]);
});

test('thirteen stones go all the way around, back into the emptied pit', () => {
  const { board: after, end, capture } = playPit(board([13, 0, 0, 0, 0, 0], 0, [1, 0, 0, 0, 0, 0], 0), 1, 0);
  assert.equal(end, 0);
  assert.equal(capture.length, 2);
  assert.deepEqual(counts(after), counts(board([0, 1, 1, 1, 1, 1], 3, [2, 1, 1, 1, 1, 0], 0)));
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
  assert.deepEqual(state.lastMove, { playerNumber: 1, pit: 0, end: 4, pickedUp: 4, captured: 0, extraTurn: false });
  assert.equal(state.gameStatus, 'A picked up 4 stones');
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.started, true);
  assert.deepEqual(addPlayer(mancala, state, 'C'), { error: 'Game already in progress' });
});

test('the last stone in your own bank gives an extra turn', () => {
  const state = play(lobby('A', 'B'), 1, 2);
  assert.equal(state.lastMove?.end, 6);
  assert.equal(state.lastMove?.extraTurn, true);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.gameStatus, 'A gets an extra turn');
  const second = play({ ...state, currentPlayer: 2 }, 2, 9);
  assert.equal(second.lastMove?.end, 13);
  assert.equal(second.currentPlayer, 2);
});

test('the last stone in an empty pit of yours captures the pit across, colors and all', () => {
  const start = { ...lobby('A', 'B'), board: board([1, 0, 4, 4, 4, 4], 0, [4, 4, 4, 4, 7, 4], 0) };
  const state = play(start, 1, 0);
  assert.deepEqual(counts(state.board), counts(board([0, 0, 4, 4, 4, 4], 8, [4, 4, 4, 4, 0, 4], 0)));
  assert.deepEqual(state.board[6], [1, 2, 2, 2, 2, 2, 2, 2]);
  assert.equal(state.lastMove?.captured, 8);
  assert.equal(state.gameStatus, 'A captured 8 stones');
  assert.equal(state.currentPlayer, 2);
});

test('no capture when the pit across is empty or the empty pit is the opponent\'s', () => {
  const across = { ...lobby('A', 'B'), board: board([1, 0, 4, 4, 4, 4], 0, [4, 4, 4, 4, 0, 4], 0) };
  assert.equal(play(across, 1, 0).lastMove?.captured, 0);
  assert.equal(play(across, 1, 0).board[1].length, 1);
  assert.equal(play(across, 1, 0).gameStatus, 'A picked up 1 stone');

  const theirs = { ...lobby('A', 'B'), board: board([4, 4, 4, 4, 4, 2], 0, [0, 4, 4, 4, 4, 4], 0) };
  const state = play(theirs, 1, 5);
  assert.equal(state.lastMove?.captured, 0);
  assert.deepEqual(state.board[7], [1]);
});

test('seat 2 captures on its own side', () => {
  const start = { ...lobby('A', 'B'), currentPlayer: 2, board: board([4, 4, 4, 5, 4, 4], 0, [4, 1, 0, 4, 4, 4], 0) };
  const state = play(start, 2, 8);
  assert.equal(state.lastMove?.captured, 6);
  assert.deepEqual(state.board[13], [2, 1, 1, 1, 1, 1]);
  assert.equal(state.board[2].length, 4);
  assert.equal(state.board[3].length, 0);
});

test('when a side empties, the rest go to their owner\'s bank and the most stones win', () => {
  const start = { ...lobby('A', 'B'), board: board([0, 0, 0, 0, 0, 1], 20, [1, 2, 0, 0, 0, 0], 24) };
  const turn = playPit(start.board, 1, 5);
  assert.deepEqual(turn.sweep, [{ from: 7, to: 13 }, { from: 8, to: 13 }, { from: 8, to: 13 }]);
  const state = play(start, 1, 5);
  assert.deepEqual(counts(state.board), counts(board([0, 0, 0, 0, 0, 0], 21, [0, 0, 0, 0, 0, 0], 27)));
  assert.equal(state.isGameOver, true);
  assert.equal(state.currentPlayer, null);
  assert.deepEqual(state.winners, [2]);
  assert.equal(state.gameStatus, 'B wins 27 to 21!');
  assert.deepEqual(applyMove(mancala, state, 1, { pit: 0 }), { error: 'The game is over' });
});

test('equal banks are a draw', () => {
  const start = { ...lobby('A', 'B'), board: board([0, 0, 0, 0, 0, 1], 23, [0, 0, 0, 0, 0, 0], 24) };
  const state = play(start, 1, 5);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, []);
  assert.equal(state.gameStatus, 'Draw, 24 stones each');
});

test('the last connected player wins', () => {
  const state = removePlayer(mancala, play(lobby('A', 'B'), 1, 0), 1);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [2]);
});
