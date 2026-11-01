import { test } from 'node:test';
import assert from 'node:assert/strict';
import { complete, emptyDraft, placeAt, rotate } from './draft.ts';

test('placeAt puts a ship by its top left end', () => {
  const draft = placeAt(emptyDraft(), 0, { row: 1, col: 6 }, 'down');
  assert.deepEqual(draft[0], { length: 5, row: 1, col: 6, orientation: 'down' });
  assert.deepEqual(draft.slice(1), [null, null, null, null]);
  const moved = placeAt(draft, 0, { row: 0, col: 0 }, 'across');
  assert.deepEqual(moved[0], { length: 5, row: 0, col: 0, orientation: 'across' });
});

test('placeAt refuses off the grid and overlaps', () => {
  const draft = placeAt(emptyDraft(), 0, { row: 0, col: 0 }, 'across');
  assert.equal(placeAt(draft, 1, { row: 0, col: 7 }, 'across'), draft);
  assert.equal(placeAt(draft, 1, { row: 7, col: 0 }, 'down'), draft);
  assert.equal(placeAt(draft, 1, { row: 0, col: 4 }, 'down'), draft);
  assert.notEqual(placeAt(draft, 1, { row: 1, col: 0 }, 'across'), draft); // touching is allowed
});

test('rotate keeps the end square and is refused at the edge', () => {
  const draft = placeAt(emptyDraft(), 2, { row: 4, col: 4 }, 'across');
  assert.deepEqual(rotate(draft, 2)[2], { length: 3, row: 4, col: 4, orientation: 'down' });
  const edge = placeAt(emptyDraft(), 2, { row: 9, col: 0 }, 'across');
  assert.equal(rotate(edge, 2), edge);
  assert.equal(rotate(edge, 0), edge); // an unplaced ship has nothing to turn
});

test('complete is null until every ship is placed', () => {
  let draft = emptyDraft();
  for (let index = 0; index < 4; index++) draft = placeAt(draft, index, { row: index * 2, col: 0 }, 'across');
  assert.equal(complete(draft), null);
  draft = placeAt(draft, 4, { row: 8, col: 0 }, 'across');
  assert.deepEqual(complete(draft)?.map(ship => ship.length), [5, 4, 3, 3, 2]);
});
