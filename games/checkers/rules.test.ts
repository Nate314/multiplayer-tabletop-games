import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZE, applyAction, createBoard, getLegalMoves, isDarkSquare, isJump, moveSummary } from './rules.ts';
import { checkers } from './index.ts';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import type { Board, GameState, Move, Position, Seat } from './types.ts';

const at = (row: number, col: number): Position => ({ row, col });

// An empty board with the given pieces; a king is marked with a fourth `true`
function boardWith(...pieces: [number, number, Seat, boolean?][]): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  for (const [row, col, seat, king = false] of pieces) board[row][col] = { seat, king };
  return board;
}

function seated(result: ReturnType<typeof addPlayer<GameState>>) {
  if ('error' in result) assert.fail(result.error);
  return result;
}

function lobby(...names: string[]): GameState {
  let state = checkers.createGameState('g1');
  for (const name of names) state = seated(addPlayer(checkers, state, name)).state;
  return state;
}

function play(state: GameState, seat: Seat, move: Move): GameState {
  const result = applyMove(checkers, state, seat, move);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function act(state: GameState, seat: Seat, action: unknown): GameState {
  const result = applyAction(state, seat, action);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const move = (...path: Position[]): Move => ({ type: 'move', path });

function countPieces(board: Board, seat: Seat): number {
  return board.flat().filter(piece => piece?.seat === seat).length;
}

test('each side starts with 12 men on the dark squares of its three rows', () => {
  const board = createBoard();
  assert.equal(countPieces(board, 1), 12);
  assert.equal(countPieces(board, 2), 12);
  board.forEach((cells, row) => cells.forEach((piece, col) => {
    if (piece) assert.equal(isDarkSquare(at(row, col)), true);
    if (piece?.seat === 1) assert.ok(row >= 5);
    if (piece?.seat === 2) assert.ok(row <= 2);
  }));
});

test('seat 1 has seven opening moves, all one step up the board', () => {
  const moves = getLegalMoves(createBoard(), 1);
  assert.equal(moves.length, 7);
  for (const [from, to] of moves) {
    assert.equal(from.row, 5);
    assert.equal(to.row, 4);
  }
});

test('men step forward only, kings step both ways', () => {
  assert.deepEqual(getLegalMoves(boardWith([4, 3, 1]), 1), [[at(4, 3), at(3, 2)], [at(4, 3), at(3, 4)]]);
  assert.deepEqual(getLegalMoves(boardWith([4, 3, 2]), 2), [[at(4, 3), at(5, 2)], [at(4, 3), at(5, 4)]]);
  assert.equal(getLegalMoves(boardWith([4, 3, 1, true]), 1).length, 4);
});

test('a piece cannot step off the board or onto another piece', () => {
  assert.deepEqual(getLegalMoves(boardWith([4, 0, 1], [3, 1, 1]), 1), [
    [at(3, 1), at(2, 0)], [at(3, 1), at(2, 2)]
  ]);
});

test('a capture is mandatory when any piece can jump', () => {
  const board = boardWith([5, 2, 1], [4, 3, 2], [5, 6, 1]);
  assert.deepEqual(getLegalMoves(board, 1), [[at(5, 2), at(3, 4)]]);
});

test('a multi-jump must be taken to the end, and every branch is offered', () => {
  // From (7,0): over (6,1) to (5,2), then over (4,1) to (3,0) or over (4,3) to (3,4)
  const board = boardWith([7, 0, 1], [6, 1, 2], [4, 1, 2], [4, 3, 2]);
  assert.deepEqual(getLegalMoves(board, 1), [
    [at(7, 0), at(5, 2), at(3, 0)],
    [at(7, 0), at(5, 2), at(3, 4)]
  ]);
});

test('a man crowned by a jump stops there, while a king keeps jumping', () => {
  // The man lands on the far row at (0,3); jumping on over (1,4) would need a king
  const man = boardWith([2, 1, 1], [1, 2, 2], [1, 4, 2]);
  assert.deepEqual(getLegalMoves(man, 1), [[at(2, 1), at(0, 3)]]);

  const king = boardWith([2, 1, 1, true], [1, 2, 2], [1, 4, 2]);
  assert.deepEqual(getLegalMoves(king, 1), [[at(2, 1), at(0, 3), at(2, 5)]]);
});

test('a piece cannot jump its own side or land off the board', () => {
  assert.equal(getLegalMoves(boardWith([6, 1, 1], [5, 2, 1]), 1).some(isJump), false);
  assert.deepEqual(getLegalMoves(boardWith([1, 1, 1], [0, 0, 2], [0, 2, 2]), 1), []);
});

test('moves are validated, including untrusted input', () => {
  const state = lobby('A', 'B');
  assert.deepEqual(applyMove(checkers, state, 1, { type: 'wall' }), { error: 'Unknown move type' });
  assert.deepEqual(applyMove(checkers, state, 1, null), { error: 'Unknown move type' });
  assert.deepEqual(applyMove(checkers, state, 1, { type: 'move', path: 'a' }), { error: 'Invalid move' });
  assert.deepEqual(applyMove(checkers, state, 1, { type: 'move', path: [{ row: '5', col: 0 }, at(4, 1)] }), { error: 'Invalid move' });
  assert.deepEqual(applyMove(checkers, state, 1, move(at(5, 0), at(3, 2))), { error: 'Invalid move' });
  assert.deepEqual(applyMove(checkers, state, 2, move(at(2, 1), at(3, 0))), { error: 'Not your turn' });
});

test('a step moves the man and passes the turn', () => {
  const state = play(lobby('A', 'B'), 1, move(at(5, 0), at(4, 1)));
  assert.equal(state.board[5][0], null);
  assert.deepEqual(state.board[4][1], { seat: 1, king: false });
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.gameStatus, 'A moved');
  assert.deepEqual(state.lastMove, { playerNumber: 1, path: [at(5, 0), at(4, 1)], captured: [], crowned: false });
});

test('skipping a capture is refused; the capture removes the jumped piece', () => {
  const start = { ...lobby('A', 'B'), board: boardWith([5, 2, 1], [4, 3, 2], [5, 6, 1], [0, 1, 2]) };
  assert.deepEqual(applyMove(checkers, start, 1, move(at(5, 6), at(4, 5))), { error: 'Invalid move: you must capture' });

  const state = play(start, 1, move(at(5, 2), at(3, 4)));
  assert.equal(state.board[4][3], null);
  assert.deepEqual(state.lastMove?.captured, [at(4, 3)]);
  assert.equal(state.gameStatus, 'A captured a piece');
});

test('a partial multi-jump is refused and the whole one is one turn', () => {
  const start = { ...lobby('A', 'B'), board: boardWith([7, 0, 1], [6, 1, 2], [4, 1, 2], [0, 7, 2]) };
  assert.deepEqual(applyMove(checkers, start, 1, move(at(7, 0), at(5, 2))), { error: 'Invalid move: you must capture' });

  const state = play(start, 1, move(at(7, 0), at(5, 2), at(3, 0)));
  assert.equal(countPieces(state.board, 2), 1);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.gameStatus, 'A captured 2 pieces');
});

test('a man reaching the far row is crowned', () => {
  const start = { ...lobby('A', 'B'), board: boardWith([1, 2, 1], [5, 6, 2]) };
  const state = play(start, 1, move(at(1, 2), at(0, 1)));
  assert.deepEqual(state.board[0][1], { seat: 1, king: true });
  assert.equal(state.lastMove?.crowned, true);
  assert.equal(state.gameStatus, 'A moved and crowned a king');
});

test('taking the last piece wins', () => {
  const start = { ...lobby('A', 'B'), board: boardWith([5, 2, 1], [4, 3, 2]) };
  const state = play(start, 1, move(at(5, 2), at(3, 4)));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.currentPlayer, null);
  assert.equal(state.gameStatus, 'A wins! B has no pieces left.');
});

test('leaving the other side with no legal move wins', () => {
  // Seat 2's man at (6,1) can neither step onto (7,0) and (7,2) nor jump off the board.
  // Seat 1 has no capture either, since (5,0) and (5,2) are filled.
  const blocked = { ...lobby('A', 'B'), board: boardWith([7, 0, 1], [7, 2, 1], [5, 0, 1], [5, 2, 1], [6, 1, 2]) };
  const won = play(blocked, 1, move(at(5, 2), at(4, 3)));
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1]);
  assert.equal(won.gameStatus, 'A wins! B has no legal moves.');
});

test('king moves without captures never draw by themselves', () => {
  const kings = { ...lobby('A', 'B'), board: boardWith([7, 0, 1, true], [0, 7, 2, true]) };
  const shuffle = [move(at(7, 0), at(6, 1)), move(at(0, 7), at(1, 6)), move(at(6, 1), at(7, 0)), move(at(1, 6), at(0, 7))];
  const moves = Array.from({ length: 50 }, () => shuffle).flat();
  const state = moves.reduce((current, next) => play(current, current.currentPlayer as Seat, next), kings);
  assert.equal(state.isGameOver, false);
});

test("a player may resign at any time, even on the opponent's turn", () => {
  const state = play(lobby('A', 'B'), 1, move(at(5, 0), at(4, 1)));
  const resigned = act(state, 1, { type: 'resign' });
  assert.equal(resigned.isGameOver, true);
  assert.deepEqual(resigned.winners, [2]);
  assert.equal(resigned.gameStatus, 'A resigned. B wins!');
});

test('a draw is agreed when the opponent accepts the offer; a move by the opponent declines it', () => {
  const state = play(lobby('A', 'B'), 1, move(at(5, 0), at(4, 1)));
  const offered = act(state, 1, { type: 'offerDraw' });
  assert.equal(offered.drawOffer, 1);
  assert.deepEqual(checkers.waitingOn?.(offered), [2]);
  const agreed = act(offered, 2, { type: 'answerDraw', accept: true });
  assert.equal(agreed.isGameOver, true);
  assert.deepEqual(agreed.winners, []);
  assert.equal(agreed.gameStatus, 'Draw by agreement');

  const lapsed = play(offered, 2, move(at(2, 1), at(3, 0)));
  assert.equal(lapsed.drawOffer, null);
  assert.equal(lapsed.isGameOver, false);
});

test('exactly two players can sit; a dismissal leaves the other the winner', () => {
  let state = lobby('A', 'B');
  assert.deepEqual(addPlayer(checkers, state, 'C'), { error: 'Game is full' });
  state = play(state, 1, move(at(5, 0), at(4, 1)));
  state = removePlayer(checkers, state, 2);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
});

test('move summaries count the captures', () => {
  assert.equal(moveSummary('A', { captured: [], crowned: false }), 'A moved');
  assert.equal(moveSummary('A', { captured: [at(1, 1), at(3, 3), at(5, 5)], crowned: true }), 'A captured 3 pieces and crowned a king');
});
