import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rackSlides, tilesUsed } from './animateMove.ts';

const tiles = (letters: string) => letters.split('');

test('a play keeps the other tiles in order and draws new ones after them', () => {
  // C and E went on the board; X and Y were drawn
  assert.deepEqual(rackSlides(tiles('ABCDEFG'), [0, 1, 2, 3, 4, 5, 6], tiles('ABDFGXY'), 2), {
    kept: [[0, 0], [1, 1], [3, 2], [5, 3], [6, 4]],
    drawn: [5, 6],
    left: [2, 4]
  });
});

test('kept tiles slide from the places a shuffle showed them at', () => {
  // The rack showed slots 3, 0, 2, 1: D, A, C, B. B went on the board.
  assert.deepEqual(rackSlides(tiles('ABCD'), [3, 0, 2, 1], tiles('ACDZ'), 1), {
    kept: [[1, 0], [2, 1], [0, 2]],
    drawn: [3],
    left: [3]
  });
});

test('of two equal letters, either can be the one that stayed', () => {
  assert.deepEqual(rackSlides(tiles('EEA'), [0, 1, 2], tiles('EAQ'), 1), {
    kept: [[0, 0], [2, 1]],
    drawn: [2],
    left: [1]
  });
});

test('an empty bag leaves the rack shorter', () => {
  assert.deepEqual(rackSlides(tiles('ABC'), [0, 1, 2], tiles('B'), 2), {
    kept: [[1, 0]],
    drawn: [],
    left: [0, 2]
  });
});

test('a pass uses no tiles; a play and an exchange use theirs', () => {
  assert.equal(tilesUsed({ type: 'pass', playerNumber: 1 }), 0);
  assert.equal(tilesUsed({ type: 'exchange', playerNumber: 1, count: 3 }), 3);
  const play = { type: 'play', playerNumber: 1, words: [], bingo: false, points: 4 } as const;
  assert.equal(tilesUsed({ ...play, tiles: [{ row: 7, col: 7, letter: 'A' }, { row: 7, col: 8, letter: 'T' }] }), 2);
});
