import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewOf } from './historyView.ts';
import type { GameFileStep } from '../../shared/gameFile.ts';
import type { HistoryStep } from '../../shared/types.ts';

const seat1 = { historyStep: 'start', seat: 1 } as unknown as HistoryStep;
const table = { historyStep: 'start', views: { '1': seat1 } } as unknown as GameFileStep;

test('no viewer returns the table step', () => {
  assert.equal(viewOf(table, null), table);
});

test('a seat with a view returns that view', () => {
  assert.equal(viewOf(table, 1), seat1);
});

test('a seat missing from views returns the table step', () => {
  assert.equal(viewOf(table, 2), table);
});

test('a step without views returns the table step', () => {
  const plain = { historyStep: 'start' } as unknown as GameFileStep;
  assert.equal(viewOf(plain, 1), plain);
});
