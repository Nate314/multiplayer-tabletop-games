import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLUMNS, ROWS, applyAction, createBoard, landingRow, moveSummary } from './rules.ts';
import { connectfour } from './index.ts';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import type { Board, GameState, Seat } from './types.ts';

function seated(result: ReturnType<typeof addPlayer<GameState>>) {
  if ('error' in result) assert.fail(result.error);
  return result;
}

function lobby(...names: string[]): GameState {
  let state = connectfour.createGameState('g1');
  for (const name of names) state = seated(addPlayer(connectfour, state, name)).state;
  return state;
}

function drop(state: GameState, seat: Seat, column: number): GameState {
  const result = applyMove(connectfour, state, seat, { type: 'drop', column });
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function act(state: GameState, seat: Seat, action: unknown): GameState {
  const result = applyAction(state, seat, action);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// Plays the columns in turn, seat 1 first
function playColumns(state: GameState, columns: number[]): GameState {
  return columns.reduce((current, column) => drop(current, current.currentPlayer as Seat, column), state);
}

// A board built from rows of '.', '1' and '2', top row first
function boardOf(...rows: string[]): Board {
  return rows.map(row => [...row].map(cell => cell === '.' ? null : Number(cell) as Seat));
}

// Full except the top of column 6, with no four in a row anywhere
const NEARLY_FULL = [
  '1221122',
  '2112211',
  '1221122',
  '2112211',
  '1221122',
  '2112211'
];

function nearlyFull(): Board {
  const board = boardOf(...NEARLY_FULL);
  board[0][6] = null;
  return board;
}

test('the board is seven columns by six rows and starts empty', () => {
  const board = createBoard();
  assert.equal(board.length, ROWS);
  assert.ok(board.every(row => row.length === COLUMNS && row.every(cell => cell === null)));
  assert.equal(lobby('A', 'B').currentPlayer, 1);
});

test('a disc falls to the lowest empty cell', () => {
  let state = drop(lobby('A', 'B'), 1, 3);
  assert.equal(state.board[5][3], 1);
  assert.deepEqual(state.lastMove, { playerNumber: 1, row: 5, column: 3 });
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.gameStatus, 'A dropped a disc in column 4');
  state = drop(state, 2, 3);
  assert.equal(state.board[4][3], 2);
  assert.equal(state.board[5][3], 1);
  assert.equal(landingRow(state.board, 3), 3);
  assert.equal(landingRow(state.board, 0), 5);
});

test('a full column is refused', () => {
  const state = playColumns(lobby('A', 'B'), [0, 0, 0, 0, 0, 0]);
  assert.equal(state.board[0][0], 2);
  assert.deepEqual(applyMove(connectfour, state, 1, { type: 'drop', column: 0 }), { error: 'That column is full' });
  assert.equal(drop(state, 1, 1).board[5][1], 1);
});

test('four in a row wins horizontally, vertically and on both diagonals', () => {
  const horizontal = playColumns(lobby('A', 'B'), [0, 0, 1, 1, 2, 2, 3]);
  assert.equal(horizontal.isGameOver, true);
  assert.deepEqual(horizontal.winners, [1]);
  assert.deepEqual(horizontal.winningLine, [0, 1, 2, 3].map(col => ({ row: 5, col })));
  assert.equal(horizontal.gameStatus, 'A wins with four in a row!');
  assert.equal(horizontal.currentPlayer, null);

  const vertical = playColumns(lobby('A', 'B'), [0, 1, 0, 1, 0, 1, 0]);
  assert.deepEqual(vertical.winners, [1]);
  assert.deepEqual(vertical.winningLine, [2, 3, 4, 5].map(row => ({ row, col: 0 })));

  // Seat 1 climbs up and to the right: columns 0 to 3 at rows 5, 4, 3, 2. A line is listed from its top cell down.
  const rising = playColumns(lobby('A', 'B'), [0, 1, 1, 2, 3, 2, 2, 3, 3, 6, 3]);
  assert.deepEqual(rising.winners, [1]);
  assert.deepEqual(rising.winningLine, [3, 2, 1, 0].map(col => ({ row: 5 - col, col })));

  // The mirror image: seat 1 climbs up and to the left
  const falling = playColumns(lobby('A', 'B'), [6, 5, 5, 4, 3, 4, 4, 3, 3, 0, 3]);
  assert.deepEqual(falling.winners, [1]);
  assert.deepEqual(falling.winningLine, [3, 4, 5, 6].map(col => ({ row: 5 - (6 - col), col })));

  // The second player can win too
  const second = playColumns(lobby('A', 'B'), [0, 1, 0, 2, 6, 3, 6, 4]);
  assert.deepEqual(second.winners, [2]);
});

test('a line is found when the last disc fills the middle of it', () => {
  const state = { ...lobby('A', 'B'), board: boardOf('.......', '.......', '.......', '.......', '.......', '11.1...') };
  const won = drop(state, 1, 2);
  assert.deepEqual(won.winners, [1]);
  assert.deepEqual(won.winningLine, [0, 1, 2, 3].map(col => ({ row: 5, col })));
});

test('three in a row, or a line broken by the other seat, is not a win', () => {
  assert.equal(playColumns(lobby('A', 'B'), [0, 0, 1, 1, 2]).isGameOver, false);
  const broken = { ...lobby('A', 'B'), board: boardOf('.......', '.......', '.......', '.......', '.......', '112.1..') };
  assert.equal(drop(broken, 1, 3).isGameOver, false);
});

test('a full board with no four is a draw', () => {
  const state = { ...lobby('A', 'B'), board: nearlyFull(), currentPlayer: 2 as Seat };
  const drawn = drop(state, 2, 6);
  assert.equal(drawn.isGameOver, true);
  assert.deepEqual(drawn.winners, []);
  assert.equal(drawn.winningLine, null);
  assert.equal(drawn.gameStatus, 'The board is full. Draw.');
});

test('a winning last disc on a full board is a win, not a draw', () => {
  const board = nearlyFull();
  for (const row of [1, 2, 3]) board[row][6] = 1;
  const won = drop({ ...lobby('A', 'B'), board }, 1, 6);
  assert.deepEqual(won.winners, [1]);
});

test('invalid moves are refused and leave the state unchanged', () => {
  const state = lobby('A', 'B');
  const refused = (move: unknown, seat: Seat = 1) => applyMove(connectfour, state, seat, move);
  assert.deepEqual(refused({ type: 'wall' }), { error: 'Unknown move type' });
  assert.deepEqual(refused(null), { error: 'Unknown move type' });
  for (const column of [-1, 7, 1.5, '3', null, undefined, NaN]) {
    assert.deepEqual(refused({ type: 'drop', column }), { error: 'Invalid column' });
  }
  assert.deepEqual(refused({ type: 'drop', column: 0 }, 2), { error: 'Not your turn' });
  assert.deepEqual(state, lobby('A', 'B'));
});

test('resign and draw by agreement end the game', () => {
  const state = drop(lobby('A', 'B'), 1, 3);
  const resigned = act(state, 1, { type: 'resign' });
  assert.equal(resigned.isGameOver, true);
  assert.deepEqual(resigned.winners, [2]);
  assert.equal(resigned.gameStatus, 'A resigned. B wins!');

  const offered = act(state, 1, { type: 'offerDraw' });
  assert.equal(offered.drawOffer, 1);
  assert.deepEqual(connectfour.waitingOn?.(offered), [2]);
  const agreed = act(offered, 2, { type: 'answerDraw', accept: true });
  assert.equal(agreed.isGameOver, true);
  assert.deepEqual(agreed.winners, []);
  assert.equal(agreed.gameStatus, 'Draw by agreement');

  // A move by the opponent declines the offer
  assert.equal(drop(offered, 2, 4).drawOffer, null);
  assert.deepEqual(applyAction(lobby('A', 'B'), 1, { type: 'resign' }), { error: 'The game has not started' });
  assert.deepEqual(applyAction(state, 1, { type: 'bogus' }), { error: 'Unknown action' });
});

test('exactly two players can sit; a dismissed player mid-turn leaves the other the winner', () => {
  let state = lobby('A', 'B');
  assert.deepEqual(addPlayer(connectfour, state, 'C'), { error: 'Game is full' });
  state = drop(state, 1, 3);
  state = removePlayer(connectfour, state, 2); // it was B's turn
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
});

test('table view hides nothing: every step shows the same board to every viewer', () => {
  let state = lobby('A', 'B');
  for (const column of [3, 3, 4, 4, 5]) {
    state = drop(state, state.currentPlayer as Seat, column);
    const table = connectfour.toPublicState(state, true, null);
    for (const viewer of [1, 2] as Seat[]) {
      assert.deepEqual(connectfour.toPublicState(state, true, viewer), table);
    }
  }
});

test('move summaries name the column from one', () => {
  assert.equal(moveSummary('A', 0), 'A dropped a disc in column 1');
});
