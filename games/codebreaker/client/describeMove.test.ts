import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove, feedbackText } from './describeMove.ts';
import type { Board, LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const guesses = (count: number): Board => ({
  guesses: Array.from({ length: count }, () => ({ pegs: [], feedback: { exact: 0, colorOnly: 0 }, by: 2 })),
  broken: false
});
const describe = (lastMove: LastMove | null, board = guesses(0)) => describeMove({ lastMove, playerNames, board });

test('the maker sets a code', () => {
  assert.equal(describe({ type: 'setCode', playerNumber: 1 }), 'Alice set a code');
});

test('a guess shows its answer pegs', () => {
  const lastMove: LastMove = { type: 'guess', playerNumber: 2, feedback: { exact: 2, colorOnly: 1 }, broken: false, outOfGuesses: false };
  assert.equal(describe(lastMove, guesses(3)), 'Bob guessed: 2 right place, 1 right color');
});

test('a guess that breaks the code counts the guesses on the board', () => {
  const lastMove: LastMove = { type: 'guess', playerNumber: 2, feedback: { exact: 4, colorOnly: 0 }, broken: true, outOfGuesses: false };
  assert.equal(describe(lastMove, guesses(5)), 'Bob broke the code in 5 guesses');
  assert.equal(describe(lastMove, guesses(1)), 'Bob broke the code in 1 guess');
});

test('the tenth miss runs out of guesses', () => {
  const lastMove: LastMove = { type: 'guess', playerNumber: 2, feedback: { exact: 1, colorOnly: 1 }, broken: false, outOfGuesses: true };
  assert.equal(describe(lastMove, guesses(10)), 'Bob ran out of guesses');
});

test('a Race guess shows only its number', () => {
  assert.equal(describe({ type: 'raceGuess', playerNumber: 2, guessNumber: 3, broken: false }), 'Bob made guess 3');
  assert.equal(describe({ type: 'raceGuess', playerNumber: 2, guessNumber: 3, broken: true }), 'Bob broke the code in 3 guesses');
});

test('taking back a guess', () => {
  assert.equal(describe({ type: 'undoOwn', playerNumber: 2 }), 'Bob took back a guess');
});

test('the starting position has no move', () => {
  assert.equal(describe(null), '');
});

test('answer pegs read as right place and right color', () => {
  assert.equal(feedbackText({ exact: 0, colorOnly: 3 }), '0 right place, 3 right color');
});
