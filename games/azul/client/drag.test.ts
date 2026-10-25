import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dragId, parseDragId, parseDropTarget } from './drag.ts';
import type { Selection } from './selection.ts';

test('a drag id names the source and color, and parses back', () => {
  const fromFactory: Selection = { source: { type: 'factory', index: 2 }, color: 'blue' };
  const fromCenter: Selection = { source: { type: 'center' }, color: 'red' };
  assert.equal(dragId(fromFactory), 'factory-2-blue');
  assert.equal(dragId(fromCenter), 'center-red');
  assert.deepEqual(parseDragId(dragId(fromFactory)), fromFactory);
  assert.deepEqual(parseDragId(dragId(fromCenter)), fromCenter);
});

test('an id that is not a source and color parses to null', () => {
  for (const id of ['junk', 'center-pink', 'factory-x-blue', 'factory--1-blue', 'center-first', '']) {
    assert.equal(parseDragId(id), null, id);
  }
});

test('drop targets are pattern lines 0 to 4 and the floor', () => {
  assert.equal(parseDropTarget('line-0'), 0);
  assert.equal(parseDropTarget('line-3'), 3);
  assert.equal(parseDropTarget('floor'), 'floor');
  assert.equal(parseDropTarget('line-9'), null);
  assert.equal(parseDropTarget('line-x'), null);
  assert.equal(parseDropTarget('wall'), null);
});
