import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_BOARD, SINGLE_LINE, boardFromLine, boardOf, branched, endLabel, endPhrase, lay, lineOf, openEnd, openEnds,
  pendingArms
} from './board.ts';
import type { Arm, Board, Layout } from './board.ts';
import { tilesOf } from './rules.ts';

const t = (a: number, b: number) =>
  tilesOf(6).findIndex(([low, high]) => low === Math.min(a, b) && high === Math.max(a, b));
const p = (a: number, b: number): [number, number] => [a, b];

const layout = (branching: Layout['branching'], chickenfoot = false, trains = false): Layout =>
  ({ branching, chickenfoot, trains });

// Lays each play in order: [a, b, arm] (the pips are the tile as held; arm is the arm id)
function play(start: Board, rules: Layout, plays: [number, number, number][], seats = [1, 2]): Board {
  return plays.reduce((board, [a, b, arm]) => lay(board, rules, t(a, b), p(a, b), arm, seats).board, start);
}
const hubOf = (rules: Layout, seats = [1, 2]) => lay(EMPTY_BOARD, rules, t(6, 6), p(6, 6), 0, seats).board;
const board34 = () => lay(EMPTY_BOARD, SINGLE_LINE, t(3, 4), p(3, 4), 0, [1, 2]).board;
const names = { 1: 'Alice', 2: 'Bob', 3: 'Cara' };

test('a non-double starter opens a left and a right end', () => {
  const { board } = lay(EMPTY_BOARD, SINGLE_LINE, t(3, 4), p(3, 4), 0, [1, 2]);
  assert.deepEqual(openEnds(board), [{ arm: 0, pips: 3 }, { arm: 1, pips: 4 }]);
  assert.equal(board.arms[0].from, null);
});

test('with no branches a double continues the line and two ends stay open', () => {
  const board = play(board34(), SINGLE_LINE, [[4, 4, 1]]);
  assert.equal(openEnd(board, 1), null);
  assert.deepEqual(openEnds(board), [{ arm: 0, pips: 3 }, { arm: 2, pips: 4 }]);
  assert.deepEqual(lineOf(board), [{ tile: t(3, 4), left: 3, right: 4 }, { tile: t(4, 4), left: 4, right: 4 }]);
});

test('a tile on the left is laid outer pips first, as the line reads', () => {
  assert.deepEqual(lay(board34(), SINGLE_LINE, t(3, 6), p(3, 6), 0, []).pips, [6, 3]);
  assert.deepEqual(lay(board34(), SINGLE_LINE, t(4, 6), p(4, 6), 1, []).pips, [4, 6]);
});

test('a starting double opens four ends unless branching is none', () => {
  for (const branching of ['starter', 'every'] as const) {
    const board = hubOf(layout(branching));
    assert.deepEqual(board.arms.map(arm => arm.name.kind), ['left', 'right', 'top', 'bottom']);
    assert.ok(board.arms.every(arm => arm.base === 6));
  }
  assert.deepEqual(hubOf(layout('none')).arms.map(arm => arm.name.kind), ['left', 'right']);
});

test('with starter only a later double continues the line, and with every double it opens two branches', () => {
  const plays: [number, number, number][] = [[6, 3, 2], [3, 3, 2]];
  const starter = play(hubOf(layout('starter')), layout('starter'), plays);
  assert.equal(openEnds(starter).length, 4);
  const every = play(hubOf(layout('every')), layout('every'), plays);
  assert.equal(openEnds(every).length, 6);
  assert.deepEqual(every.arms.slice(-3).map(arm => arm.name),
    [{ kind: 'top' }, { kind: 'branch', index: 1, pips: 3 }, { kind: 'branch', index: 2, pips: 3 }]);
});

test('with starter only and a non-double lead, the first double played becomes the spinner', () => {
  const rules = layout('starter');
  let board = play(board34(), rules, [[4, 4, 1]]);
  assert.equal(openEnds(board).length, 4);
  assert.ok(branched(board));
  board = play(board, rules, [[3, 3, 0]]);
  assert.equal(openEnds(board).length, 4);
  assert.equal(board.arms.length, 6);
});

test('with trains the starting double is a hub of one train per seat and the Mexican train, whatever the branching', () => {
  for (const branching of ['none', 'starter', 'every'] as const) {
    const board = hubOf(layout(branching, false, true), [1, 2, 3]);
    assert.deepEqual(board.arms.map(arm => arm.owner), [1, 2, 3, 'mexican']);
    assert.ok(board.arms.every(arm => arm.name.kind === 'train'));
  }
});

test('a double on a train opens branches owned by that train', () => {
  const rules = layout('every', false, true);
  const board = play(hubOf(rules), rules, [[6, 3, 1], [3, 3, 1]]);
  const children = board.arms.slice(3);
  assert.equal(children.length, 3);
  assert.ok(children.every(arm => arm.owner === 2 && arm.from === t(3, 3) && arm.base === 3));
  assert.deepEqual(children.map(arm => arm.name.kind), ['train', 'branch', 'branch']);
});

test('Chickenfoot waits on the newest unfinished double until its ends are filled', () => {
  const rules = layout('every', true);
  let board = play(board34(), rules, [[4, 4, 1]]);
  assert.deepEqual(pendingArms(board, rules), [2, 3, 4]);
  board = play(board, rules, [[4, 3, 2], [4, 6, 3]]);
  assert.deepEqual(pendingArms(board, rules), [4]);
  board = play(board, rules, [[4, 5, 4]]);
  assert.deepEqual(pendingArms(board, rules), []);
  assert.deepEqual(pendingArms(play(board34(), layout('every'), [[4, 4, 1]]), layout('every')), []);
});

test('Chickenfoot finishes a newer unfinished double before an older one', () => {
  const rules = layout('every', true);
  const filledTile = [{ tile: 0, inner: 1, outer: 2 }];
  const arm = (from: number | null, name: Arm['name'], tiles: Arm['tiles'] = []): Arm =>
    ({ from, base: 1, name, owner: null, tiles });
  const board: Board = {
    start: { tile: t(1, 2), left: 1, right: 2 },
    arms: [
      arm(null, { kind: 'left' }, filledTile),
      arm(null, { kind: 'right' }, filledTile),
      arm(10, { kind: 'right' }),
      arm(10, { kind: 'branch', index: 1, pips: 1 }, filledTile),
      arm(20, { kind: 'right' }),
      arm(20, { kind: 'branch', index: 1, pips: 1 })
    ]
  };
  assert.deepEqual(pendingArms(board, rules), [4, 5]);
  const filled: Board = { ...board, arms: board.arms.map((a, i) => (i >= 4 ? { ...a, tiles: filledTile } : a)) };
  assert.deepEqual(pendingArms(filled, rules), [2]);
});

test('Chickenfoot exempts the trains hub but not a double played on a train', () => {
  const rules = layout('every', true, true);
  const hub = hubOf(rules);
  assert.deepEqual(pendingArms(hub, rules), []);
  assert.deepEqual(pendingArms(play(hub, rules, [[6, 3, 0], [3, 3, 0]]), rules), [3, 4, 5]);
});

test('Chickenfoot asks a non-branching double for its one forward end, and the starter hub for all four', () => {
  const none = layout('none', true);
  assert.deepEqual(pendingArms(play(board34(), none, [[4, 4, 1]]), none), [2]);
  const every = layout('every', true);
  assert.deepEqual(pendingArms(hubOf(every), every), [0, 1, 2, 3]);
});

test('boardFromLine keeps the open ends and the left-to-right reading of a saved line', () => {
  const line = [{ tile: t(6, 3), left: 6, right: 3 }, { tile: t(3, 4), left: 3, right: 4 }, { tile: t(4, 4), left: 4, right: 4 }];
  assert.deepEqual(lineOf(boardFromLine(line)), line);
  assert.deepEqual(openEnds(boardFromLine(line)).map(end => end.pips), [6, 4]);
  assert.deepEqual(boardOf({ line }), boardFromLine(line));
  assert.deepEqual(boardOf({}), EMPTY_BOARD);
  assert.equal(boardOf({ board: board34(), line }).arms.length, 2);
});

test('end labels and phrases name every kind of end', () => {
  const hub = hubOf(layout('every', false, true));
  assert.equal(endLabel(hub, 1, names), "Bob's train");
  assert.equal(endPhrase(hub, 1, names), "on Bob's train");
  assert.equal(endLabel(hub, 2, names), 'Mexican train');
  assert.equal(endPhrase(hub, 2, names), 'on the Mexican train');
  const four = hubOf(layout('every'));
  ['Left', 'Right', 'Top', 'Bottom'].forEach((side, arm) => {
    assert.equal(endLabel(four, arm, names), `${side} end`);
    assert.equal(endPhrase(four, arm, names), `on the ${side.toLowerCase()}`);
  });
  const branches = play(board34(), layout('every'), [[4, 4, 1]]);
  assert.equal(endLabel(branches, 3, names), 'First branch of 4-4');
  assert.equal(endPhrase(branches, 3, names), 'on the first branch of 4-4');
  assert.equal(endLabel(branches, 4, names), 'Second branch of 4-4');
  assert.equal(endPhrase(branches, 4, names), 'on the second branch of 4-4');
});
