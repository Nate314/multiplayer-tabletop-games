import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seatOptions, viewFor } from './historyView.ts';
import type { GameFileStep } from '../../shared/gameFile.ts';
import type { HistoryStep } from '../../shared/types.ts';

const seat1 = { historyStep: 'start', seat: 1 } as unknown as HistoryStep;
const table = { historyStep: 'start', views: { '1': seat1 } } as unknown as GameFileStep;

test('a step without views falls back to the table', () => {
  const plain = { historyStep: 'start' } as unknown as GameFileStep;
  assert.deepEqual(viewFor(plain, 1), { step: plain, viewer: null });
});

test('viewFor keeps the viewer when the seat has a view', () => {
  assert.deepEqual(viewFor(table, 1), { step: seat1, viewer: 1 });
});

test('viewFor drops the viewer when the seat has no view', () => {
  assert.deepEqual(viewFor(table, 2), { step: table, viewer: null });
});

test('viewFor with no viewer returns the table step', () => {
  assert.deepEqual(viewFor(table, null), { step: table, viewer: null });
});

function withNames(playerNames: unknown, views: unknown = {}) {
  return { historyStep: 'start', playerNames, views } as unknown as GameFileStep;
}

test('seatOptions lists each seat with its name', () => {
  assert.deepEqual(seatOptions(withNames({ 1: 'Ann', 2: 'Bo' })), [
    { seat: '1', name: 'Ann' },
    { seat: '2', name: 'Bo' },
  ]);
});

test('seatOptions is empty without views', () => {
  const noViews = { historyStep: 'start', playerNames: { 1: 'Ann' } } as unknown as GameFileStep;
  assert.deepEqual(seatOptions(noViews), []);
});

test('seatOptions is empty when playerNames is missing or null', () => {
  assert.deepEqual(seatOptions(withNames(undefined)), []);
  assert.deepEqual(seatOptions(withNames(null)), []);
});

test('seatOptions names a seat by number when its name is not a string', () => {
  assert.deepEqual(seatOptions(withNames({ 1: { x: 1 }, 2: 7 })), [
    { seat: '1', name: 'Seat 1' },
    { seat: '2', name: 'Seat 2' },
  ]);
});
