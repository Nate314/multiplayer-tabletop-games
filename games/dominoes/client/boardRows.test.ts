import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_BOARD, boardFromLine, lay } from '../board.ts';
import type { Board, Layout } from '../board.ts';
import { tilesOf } from '../rules.ts';
import { boardRows } from './boardRows.ts';

const t = (a: number, b: number) =>
  tilesOf(6).findIndex(([low, high]) => low === Math.min(a, b) && high === Math.max(a, b));
const layout = (branching: Layout['branching'], trains = false): Layout => ({ branching, chickenfoot: false, trains });
const names = { 1: 'Alice', 2: 'Bob', 3: 'Cara' };

// Lays the starter, then each play in order: [a, b, arm]
function build(rules: Layout, start: [number, number], plays: [number, number, number][], seats = [1, 2]): Board {
  const hub = lay(EMPTY_BOARD, rules, t(...start), start, 0, seats).board;
  return plays.reduce((board, [a, b, arm]) => lay(board, rules, t(a, b), [a, b], arm, seats).board, hub);
}
const line = [[6, 3], [3, 4], [4, 5]].map(([left, right]) => ({ tile: t(left, right), left, right }));

test('with no branches the board is one hub row that reads as today\'s line', () => {
  const rows = boardRows(boardFromLine(line), names, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].key, 'hub');
  assert.equal(rows[0].label, null);
  assert.deepEqual(rows[0].cells.filter(cell => cell.kind === 'tile').map(cell => cell.pips), [[6, 3], [3, 4], [4, 5]]);
  assert.deepEqual(rows[0].cells.filter(cell => cell.kind === 'end').map(cell => cell.pips), [6, 5]);
  assert.equal(rows[0].cells[0].kind, 'end');
  assert.equal(rows[0].cells[rows[0].cells.length - 1].kind, 'end');
});

test('a spinner puts its top arm above the hub row and its bottom arm below', () => {
  // Arms of the 6-6 hub: 0 left, 1 right, 2 top, 3 bottom
  const rows = boardRows(build(layout('starter'), [6, 6], [[6, 3, 2], [6, 1, 3]]), names, []);
  assert.deepEqual(rows.map(row => row.place), ['above', 'hub', 'below']);
  assert.deepEqual(rows.map(row => row.label), ['Top end', null, 'Bottom end']);
  assert.deepEqual(rows[0].cells, [{ kind: 'tile', tile: t(6, 3), pips: [6, 3] }, { kind: 'end', arm: 2, pips: 3 }]);
  assert.deepEqual(rows[1].cells, [{ kind: 'end', arm: 0, pips: 6 }, { kind: 'tile', tile: t(6, 6), pips: [6, 6] }, { kind: 'end', arm: 1, pips: 6 }]);
});

test('trains split above and below the hub, the Mexican train last, an open train marked', () => {
  const rows = boardRows(build(layout('every', true), [6, 6], [[6, 2, 0]], [1, 2, 3]), names, [1]);
  assert.deepEqual(rows.map(row => row.label), ["Alice's train", "Bob's train", null, "Cara's train", 'Mexican train']);
  assert.deepEqual(rows.map(row => row.place), ['above', 'above', 'hub', 'below', 'below']);
  assert.deepEqual(rows.map(row => row.open), [true, false, false, false, false]);
  // With Trains the hub row is the hub tile alone
  assert.deepEqual(rows[2].cells, [{ kind: 'tile', tile: t(6, 6), pips: [6, 6] }]);
  assert.deepEqual(rows[0].cells, [{ kind: 'tile', tile: t(6, 2), pips: [6, 2] }, { kind: 'end', arm: 0, pips: 2 }]);
});

test('each branch row follows the row of its double, one deeper', () => {
  // 3-4 starter: arm 0 left, 1 right. 4-4 on the right adds 2 (on past it), 3 and 4 (its branches).
  // 4-6 and 6-6 on its first branch add 5 (on past the 6-6), 6 and 7 (its branches)
  const rows = boardRows(build(layout('every'), [3, 4], [[4, 4, 1], [4, 6, 3], [6, 6, 3]]), names, []);
  assert.deepEqual(rows.map(row => [row.label, row.depth]), [
    [null, 0],
    ['First branch of 4-4', 1],
    ['First branch of 6-6', 2],
    ['Second branch of 6-6', 2],
    ['Second branch of 4-4', 1]
  ]);
  // A chain follows each double's forward child to the open end
  assert.deepEqual(rows[1].cells, [
    { kind: 'tile', tile: t(4, 6), pips: [4, 6] }, { kind: 'tile', tile: t(6, 6), pips: [6, 6] }, { kind: 'end', arm: 5, pips: 6 }
  ]);
  assert.deepEqual(rows[0].cells.map(cell => (cell.kind === 'end' ? `end ${cell.arm}` : cell.tile)), ['end 0', t(3, 4), t(4, 4), 'end 2']);
});

test('an empty board has no rows', () => assert.deepEqual(boardRows(EMPTY_BOARD, names, []), []));
