import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { pointsText, rankStandings, standingsOf } from './standings.ts';
import type { BaseGameState } from './types.ts';

const base = (activePlayers: number[], winners: number[]) => ({ activePlayers, winners }) as BaseGameState;

test('the fallback puts the winners first and everyone else second', () => {
  assert.deepEqual(standingsOf({}, base([1, 2, 3], [2])), [
    { seat: 2, place: 1 }, { seat: 1, place: 2 }, { seat: 3, place: 2 },
  ]);
});

test('the fallback with no winners is a draw at place 1', () => {
  assert.deepEqual(standingsOf({}, base([1, 2, 3], [])), [
    { seat: 1, place: 1 }, { seat: 2, place: 1 }, { seat: 3, place: 1 },
  ]);
});

test('rankStandings dense-ranks the rest and ties share a place', () => {
  const points: Record<number, number> = { 1: 30, 2: 80, 3: 30, 4: 101 };
  const rows = rankStandings(base([1, 2, 3, 4], [1, 3]), (a, b) => points[a] - points[b], (s) => pointsText(points[s]));
  assert.deepEqual(rows.map((r) => [r.seat, r.place]), [[1, 1], [3, 1], [2, 2], [4, 3]]);
  assert.equal(rows[3].score, '101 points');
});

test('pointsText pluralizes and groups digits', () => {
  assert.equal(pointsText(1), '1 point');
  assert.equal(pointsText(1234), '1,234 points');
});

test("standingsOf uses the game's hook", () => {
  const rows = [{ seat: 1, place: 1, score: 'x' }];
  assert.deepEqual(standingsOf({ finalStandings: () => rows }, base([1, 2], [1])), rows);
});

test('standingsOf falls back when the hook throws', () => {
  const error = mock.method(console, 'error', () => {});
  const rows = standingsOf({ finalStandings: () => { throw new Error('boom'); } }, base([1, 2], [1]));
  assert.deepEqual(rows, [{ seat: 1, place: 1 }, { seat: 2, place: 2 }]);
  assert.equal(error.mock.callCount(), 1);
  error.mock.restore();
});
