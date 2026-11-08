import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slidePlan } from './animateMove.ts';

test('tiles another player put down slide from their row; moved tiles from their old place', () => {
  const previous = { table: [[1, 2, 3]], rack: [40, 41] };
  const next = { table: [[1, 2], [3, 9, 10]], rack: [40, 41], lastMove: { type: 'play', playerNumber: 2, added: [9, 10], meld: null, wentOut: false } as const };
  assert.deepEqual(slidePlan(previous, next), [
    { id: 1, from: 'self' }, { id: 2, from: 'self' }, { id: 3, from: 'self' },
    { id: 9, from: 'seat' }, { id: 10, from: 'seat' },
    { id: 40, from: 'self' }, { id: 41, from: 'self' }
  ]);
});

test('your own play slides from your rack and a drawn tile from the pool', () => {
  const play = { type: 'play', playerNumber: 1, added: [40], meld: null, wentOut: false } as const;
  assert.deepEqual(slidePlan({ table: [], rack: [40, 41] }, { table: [[40]], rack: [41], lastMove: play }), [
    { id: 40, from: 'self' }, { id: 41, from: 'self' }
  ]);
  const draw = { type: 'draw', playerNumber: 1, drew: true } as const;
  assert.deepEqual(slidePlan({ table: [], rack: [41] }, { table: [], rack: [41, 7], lastMove: draw }), [
    { id: 41, from: 'self' }, { id: 7, from: 'pool' }
  ]);
});

test('nothing slides before the first move', () => {
  assert.deepEqual(slidePlan({ table: [], rack: [] }, { table: [], rack: [1], lastMove: null }), []);
});
