import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, moveSummary } from './rules.ts';
import { tictactoe } from './index.ts';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import type { Cells } from './lines.ts';
import type { GameState, Seat } from './types.ts';

function seated(result: ReturnType<typeof addPlayer<GameState>>) {
  if ('error' in result) assert.fail(result.error);
  return result;
}

function lobby(...names: string[]): GameState {
  let state = tictactoe.createGameState('g1');
  for (const name of names) state = seated(addPlayer(tictactoe, state, name)).state;
  return state;
}

function place(state: GameState, seat: Seat, cell: number): GameState {
  const result = applyMove(tictactoe, state, seat, { type: 'place', cell });
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function act(state: GameState, seat: Seat, action: unknown): GameState {
  const result = applyAction(state, seat, action);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// Plays the cells in turn, whoever is to move first
function playCells(state: GameState, cells: number[]): GameState {
  return cells.reduce((current, cell) => place(current, current.currentPlayer as Seat, cell), state);
}

// A board built from rows of '.', '1' and '2'
function boardOf(...rows: string[]): Cells {
  return [...rows.join('')].map(cell => cell === '.' ? null : Number(cell) as Seat);
}

test('the board starts with nine empty cells and seat 1 to move as X', () => {
  const state = lobby('Alice', 'Bob');
  assert.equal(state.board.length, 9);
  assert.ok(state.board.every(cell => cell === null));
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.xSeat, 1);
  assert.equal(tictactoe.createGameState('g1').xSeat, 1);
});

test('a mark goes in an empty cell and the turn passes', () => {
  const state = place(lobby('Alice', 'Bob'), 1, 4);
  assert.equal(state.board[4], 1);
  assert.deepEqual(state.lastMove, { playerNumber: 1, cell: 4 });
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.gameStatus, 'Alice placed X in the center');
  assert.equal(place(state, 2, 0).gameStatus, 'Bob placed O in the top left');
});

test('a taken cell is refused', () => {
  const state = place(lobby('Alice', 'Bob'), 1, 4);
  assert.deepEqual(applyMove(tictactoe, state, 2, { type: 'place', cell: 4 }), { error: 'That cell is taken' });
});

test('three in a row wins across, down and on both diagonals', () => {
  const lines: [number[], number[]][] = [
    [[0, 3, 1, 4, 2], [0, 1, 2]],
    [[3, 0, 4, 1, 5], [3, 4, 5]],
    [[0, 1, 3, 2, 6], [0, 3, 6]],
    [[2, 0, 5, 1, 8], [2, 5, 8]],
    [[0, 1, 4, 2, 8], [0, 4, 8]],
    [[2, 0, 4, 1, 6], [2, 4, 6]]
  ];
  for (const [cells, line] of lines) {
    const won = playCells(lobby('Alice', 'Bob'), cells);
    assert.equal(won.isGameOver, true);
    assert.deepEqual(won.winners, [1]);
    assert.deepEqual(won.winningLine, line);
    assert.equal(won.gameStatus, 'Alice wins with three in a row!');
    assert.equal(won.currentPlayer, null);
  }
});

test('O can win', () => {
  const won = playCells(lobby('Alice', 'Bob'), [0, 3, 1, 4, 8, 5]);
  assert.deepEqual(won.winners, [2]);
  assert.deepEqual(won.winningLine, [3, 4, 5]);
  assert.equal(won.gameStatus, 'Bob wins with three in a row!');
});

test('a full board with no line is a draw', () => {
  const state = { ...lobby('Alice', 'Bob'), board: boardOf('121', '122', '21.'), currentPlayer: 1 as Seat };
  const drawn = place(state, 1, 8);
  assert.equal(drawn.isGameOver, true);
  assert.deepEqual(drawn.winners, []);
  assert.equal(drawn.winningLine, null);
  assert.equal(drawn.gameStatus, 'The board is full. Draw.');
});

test('a ninth mark that makes three is a win, not a draw', () => {
  const state = { ...lobby('Alice', 'Bob'), board: boardOf('21.', '121', '221'), currentPlayer: 1 as Seat };
  const won = place(state, 1, 2);
  assert.deepEqual(won.winners, [1]);
  assert.deepEqual(won.winningLine, [2, 5, 8]);
});

test('bad payloads are refused and change nothing', () => {
  const state = lobby('Alice', 'Bob');
  const refused = (move: unknown) => applyMove(tictactoe, state, 1, move);
  assert.deepEqual(refused({ type: 'drop', cell: 0 }), { error: 'Unknown move type' });
  assert.deepEqual(refused(null), { error: 'Unknown move type' });
  for (const cell of ['4', 4.5, -1, 9, undefined, null, NaN]) {
    assert.deepEqual(refused({ type: 'place', cell }), { error: 'Invalid cell' });
  }
  assert.deepEqual(refused({ type: 'place' }), { error: 'Invalid cell' });
  assert.deepEqual(state, lobby('Alice', 'Bob'));
});

test('resign and draw by agreement end the game', () => {
  const state = place(lobby('Alice', 'Bob'), 1, 4);
  const resigned = act(state, 1, { type: 'resign' });
  assert.equal(resigned.isGameOver, true);
  assert.deepEqual(resigned.winners, [2]);

  const offered = act(state, 1, { type: 'offerDraw' });
  assert.deepEqual(tictactoe.waitingOn?.(offered), [2]);
  const agreed = act(offered, 2, { type: 'answerDraw', accept: true });
  assert.equal(agreed.isGameOver, true);
  assert.deepEqual(agreed.winners, []);

  // A move by the opponent declines the offer
  assert.equal(place(offered, 2, 0).drawOffer, null);
});

test('exactly two players can sit; a dismissed player mid-game leaves the other the winner', () => {
  let state = lobby('Alice', 'Bob');
  assert.deepEqual(addPlayer(tictactoe, state, 'Cy'), { error: 'Game is full' });
  state = place(state, 1, 4);
  state = removePlayer(tictactoe, state, 2);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
});

test('in game 2 seat 2 plays X and moves first', () => {
  let state: GameState = { ...tictactoe.createGameState('g1'), gameNumber: 2 };
  for (const name of ['Alice', 'Bob']) state = seated(addPlayer(tictactoe, state, name)).state;
  assert.equal(state.xSeat, 2);
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(applyMove(tictactoe, state, 1, { type: 'place', cell: 0 }), { error: 'Not your turn' });
  const moved = place(state, 2, 0);
  assert.equal(moved.gameStatus, 'Bob placed X in the top left');
  assert.equal(moveSummary('Bob', 'X', 0), 'Bob placed X in the top left');
});
