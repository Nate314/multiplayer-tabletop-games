import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countedStrokeId, echoed } from './strokeSync.ts';
import type { Stroke } from '../types.ts';

const line = (id: number, points: number[]): Stroke => ({ id, kind: 'line', tool: 'pen', color: 0, size: 1, points });

test('a sent line is echoed once the server copy has all its points', () => {
  const sent = line(4, [1, 2, 3, 4]);
  assert.equal(echoed(sent, [line(4, [1, 2])], 5), false);
  assert.equal(echoed(sent, [line(4, [1, 2, 3, 4])], 5), true);
  const fill: Stroke = { id: 4, kind: 'fill', color: 2, x: 1, y: 1 };
  assert.equal(echoed(fill, [fill], 5), true);
});

test('a sent stroke missing from the state is echoed only once its id is used', () => {
  const sent = line(4, [1, 2]);
  assert.equal(echoed(sent, [], 4), false); // not reached the server yet
  assert.equal(echoed(sent, [], 5), true); // taken back or cleared since
});

test('the id counts ahead only while a sent stroke is unechoed, and follows the server down after an undo', () => {
  assert.equal(countedStrokeId(5, 3, true), 5);
  assert.equal(countedStrokeId(2, 4, true), 4);
  assert.equal(countedStrokeId(5, 3, false), 3); // an undo vote restored a lower nextStrokeId
});
