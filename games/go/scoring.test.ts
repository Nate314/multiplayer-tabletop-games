import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaScore, scoreLine } from './scoring.ts';
import { boardOf } from './testBoards.ts';

const nine = (rows: string[]) => boardOf(rows, 9);
const columns = (row: string) => Array<string>(9).fill(row);

test('walls on columns E and F: Black 45, White 43.5', () => {
  const score = areaScore(nine(columns('....XO...')), []);
  assert.deepEqual(score.black, { stones: 9, territory: 36, total: 45 });
  assert.deepEqual(score.white, { stones: 9, territory: 27, komi: 7.5, total: 43.5 });
});

test('an unmarked enemy stone makes the area neutral; marked dead it is territory', () => {
  const rows = columns('....XO...');
  rows[4] = '.O..XO...';
  const board = nine(rows);
  const alive = areaScore(board, []);
  assert.equal(alive.black.total, 9);
  assert.equal(alive.white.total, 44.5);
  const dead = areaScore(board, [{ row: 4, col: 1 }]);
  assert.equal(dead.black.total, 45);
  assert.equal(dead.white.total, 43.5);
});

test('points between both colors count for nobody', () => {
  const score = areaScore(nine(columns('...X.O...')), []);
  assert.deepEqual(score.black, { stones: 9, territory: 27, total: 36 });
  assert.equal(score.white.total, 43.5);
});

test('an empty board is 0 to 7.5', () => {
  const score = areaScore(nine([]), []);
  assert.equal(score.black.total, 0);
  assert.equal(score.white.total, 7.5);
});

test('stones of one color own every empty point', () => {
  const rows = Array<string>(9).fill('');
  rows[4] = '....X';
  const score = areaScore(nine(rows), []);
  assert.equal(score.black.total, 81);
  assert.equal(score.white.total, 7.5);
});

test('scoreLine writes the totals', () => {
  assert.equal(scoreLine(areaScore(nine(columns('....XO...')), [])), 'Black 45, White 43.5');
});
