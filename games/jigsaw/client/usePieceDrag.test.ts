import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lostHold, samePiece, toTablePoint } from './usePieceDrag.ts';

const matrix = (a: number, b: number, c: number, d: number, e: number, f: number) =>
  ({ a, b, c, d, e, f }) as DOMMatrixReadOnly;

test('toTablePoint maps a screen point through the inverse matrix', () => {
  assert.deepEqual(toTablePoint(matrix(1, 0, 0, 1, 0, 0), 120, 45), { x: 120, y: 45 });
  // The table drawn at twice its size, its corner at (10, 20) on screen
  assert.deepEqual(toTablePoint(matrix(2, 0, 0, 2, 10, 20), 110, 220), { x: 50, y: 100 });
});

test('a drag ends when the state shows the piece placed or held by someone else', () => {
  const piece = { x: 0, y: 0, placed: false, heldBy: null, placedBy: null };
  assert.equal(lostHold(piece, 1), false); // the pick-up is still on its way
  assert.equal(lostHold({ ...piece, heldBy: 1 }, 1), false);
  assert.equal(lostHold({ ...piece, heldBy: 2 }, 1), true);
  assert.equal(lostHold({ ...piece, placed: true, placedBy: 2 }, 1), true);
  assert.equal(lostHold(undefined, 1), true);
});

test('a piece is the same when its place is, whatever the object or hold', () => {
  const piece = { x: 10, y: 20, placed: false, heldBy: 1, placedBy: null };
  assert.equal(samePiece({ ...piece }, piece), true);
  assert.equal(samePiece({ ...piece, x: 11 }, piece), false);
  assert.equal(samePiece({ ...piece, y: 21 }, piece), false);
  assert.equal(samePiece({ ...piece, heldBy: null }, piece), true); // a late pick-up answer keeps the landing
  assert.equal(samePiece({ ...piece, placed: true }, piece), false);
  assert.equal(samePiece(undefined, piece), false);
});
