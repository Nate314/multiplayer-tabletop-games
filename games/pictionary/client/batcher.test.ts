import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBatcher } from './batcher.ts';

test('the first point is sent at once and the rest every 100 ms', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sent: number[][] = [];
  const batcher = createBatcher(points => sent.push(points));
  batcher.add(1, 2);
  assert.deepEqual(sent, [[1, 2]]);
  batcher.add(3, 4);
  batcher.add(5, 6);
  t.mock.timers.tick(99);
  assert.deepEqual(sent, [[1, 2]]);
  t.mock.timers.tick(1);
  assert.deepEqual(sent, [[1, 2], [3, 4, 5, 6]]);
  batcher.add(7, 8);
  t.mock.timers.tick(100);
  assert.deepEqual(sent, [[1, 2], [3, 4, 5, 6], [7, 8]]);
});

test('flush sends what is left', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sent: number[][] = [];
  const batcher = createBatcher(points => sent.push(points));
  batcher.add(1, 2);
  batcher.add(3, 4);
  batcher.flush();
  assert.deepEqual(sent, [[1, 2], [3, 4]]);
  t.mock.timers.tick(500);
  batcher.flush();
  assert.equal(sent.length, 2);
});

test('a long batch is split to fit one action', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sent: number[][] = [];
  const batcher = createBatcher(points => sent.push(points));
  for (let i = 0; i <= 150; i++) batcher.add(i, 0);
  batcher.flush();
  assert.deepEqual(sent.map(points => points.length), [2, 200, 100]);
});
