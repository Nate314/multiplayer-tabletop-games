import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playStone, starPoints, pointName } from './board.ts';
import { boardOf } from './testBoards.ts';

test('a stone with no liberties left is captured', () => {
  const result = playStone(boardOf(['.O...', 'OX...', '.O...']), { row: 1, col: 2 }, 'white');
  assert.ok('board' in result);
  assert.deepEqual(result.captured, [{ row: 1, col: 1 }]);
  assert.equal(result.board[1][1], null);
});

test('a chain of stones is captured whole', () => {
  const result = playStone(boardOf(['XXO..', 'O....']), { row: 1, col: 1 }, 'white');
  assert.ok('board' in result);
  assert.equal(result.captured.length, 2);
  assert.equal(result.board[0][0], null);
  assert.equal(result.board[0][1], null);
});

test('one stone captures two separate chains', () => {
  const result = playStone(boardOf(['OX.XO', '.O.O.']), { row: 0, col: 2 }, 'white');
  assert.ok('board' in result);
  assert.equal(result.captured.length, 2);
  assert.ok(result.captured.some((p) => p.row === 0 && p.col === 1));
  assert.ok(result.captured.some((p) => p.row === 0 && p.col === 3));
});

test('a stone with no liberties is legal when it captures', () => {
  const result = playStone(boardOf(['.XO..', 'XO...', 'O....']), { row: 0, col: 0 }, 'white');
  assert.ok('board' in result);
  assert.equal(result.captured.length, 2);
  assert.ok(result.captured.some((p) => p.row === 0 && p.col === 1));
  assert.ok(result.captured.some((p) => p.row === 1 && p.col === 0));
  assert.equal(result.board[0][0], 'white');
});

test('suicide of one stone is refused', () => {
  const board = boardOf(['.X...', 'X....']);
  const before = JSON.stringify(board);
  assert.deepEqual(playStone(board, { row: 0, col: 0 }, 'white'), { error: 'That would be suicide' });
  assert.equal(JSON.stringify(board), before);
});

test('suicide of a chain is refused', () => {
  assert.deepEqual(playStone(boardOf(['O.X..', 'XX...']), { row: 0, col: 1 }, 'white'), {
    error: 'That would be suicide'
  });
});

test('a taken point or a point off the board is refused', () => {
  const board = boardOf(['X....']);
  assert.deepEqual(playStone(board, { row: 0, col: 0 }, 'white'), { error: 'That point is taken' });
  assert.deepEqual(playStone(board, { row: -1, col: 0 }, 'white'), { error: 'Invalid move' });
  assert.deepEqual(playStone(board, { row: 0, col: 5 }, 'white'), { error: 'Invalid move' });
});

test('star points and point names', () => {
  assert.equal(starPoints(9).length, 5);
  assert.equal(starPoints(13).length, 5);
  assert.equal(starPoints(19).length, 9);
  assert.equal(pointName({ row: 8, col: 0 }, 9), 'A1');
  assert.equal(pointName({ row: 0, col: 8 }, 9), 'J9');
});
