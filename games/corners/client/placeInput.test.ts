import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PIECES, orientations } from '../geometry.ts';
import { flip, keepSpot, spotAt, tapSpot, turn, type Draft } from './placeInput.ts';
import type { Cell } from '../geometry.ts';

const draft: Draft = { piece: 9, orientation: 0, spot: null };
const legal = [{ dx: 0, dy: 0 }, { dx: 3, dy: 1 }];

test('a first tap previews and a second places', () => {
  const first = tapSpot(draft, { dx: 3, dy: 1 }, legal);
  assert.deepEqual(first, { draft: { ...draft, spot: { dx: 3, dy: 1 } }, place: false });
  const other = tapSpot(first.draft, { dx: 0, dy: 0 }, legal);
  assert.deepEqual(other, { draft: { ...draft, spot: { dx: 0, dy: 0 } }, place: false });
  assert.deepEqual(tapSpot(other.draft, { dx: 0, dy: 0 }, legal), { draft: other.draft, place: true });
});

test('a tap on an illegal spot clears the preview', () => {
  const shown = { ...draft, spot: { dx: 3, dy: 1 } };
  assert.deepEqual(tapSpot(shown, { dx: 5, dy: 5 }, legal), { draft: { ...draft, spot: null }, place: false });
});

test('turning keeps the spot only while it stays legal', () => {
  const shown = { ...draft, spot: { dx: 3, dy: 1 } };
  const turned = turn('squares', shown, 1);
  assert.notEqual(turned.orientation, shown.orientation);
  assert.deepEqual(keepSpot(turned, legal).spot, { dx: 3, dy: 1 });
  assert.equal(keepSpot(turned, [{ dx: 0, dy: 0 }]).spot, null);
});

test('four right turns come back to the start on squares and six on triangles', () => {
  for (const [kind, turns] of [['squares', 4], ['triangles', 6]] as const) {
    PIECES[kind].forEach((_, piece) => {
      let d: Draft = { piece, orientation: 0, spot: null };
      const seen = new Set<number>();
      for (let i = 0; i < turns; i++) {
        seen.add(d.orientation);
        d = turn(kind, d, 1);
      }
      assert.equal(d.orientation, 0, `${kind} ${piece}`);
      assert.equal(turn(kind, turn(kind, d, 1), -1).orientation, 0, `${kind} ${piece} back`);
      assert.ok(seen.size <= orientations(kind, PIECES[kind][piece]).length);
    });
  }
  // The L of five squares has eight orientations, so a turn always changes it
  const l5 = PIECES.squares.findIndex(shape => shape.length === 5 && orientations('squares', shape).length === 8);
  assert.notEqual(turn('squares', { piece: l5, orientation: 0, spot: null }, 1).orientation, 0);
});

test('flipping twice comes back', () => {
  for (const kind of ['squares', 'triangles'] as const) {
    PIECES[kind].forEach((shape, piece) => {
      orientations(kind, shape).forEach((_, orientation) => {
        const d: Draft = { piece, orientation, spot: null };
        assert.equal(flip(kind, flip(kind, d)).orientation, orientation, `${kind} ${piece} ${orientation}`);
      });
    });
  }
});

test('a cell means the spot outlined on it, else the preview covering it, else any spot covering it', () => {
  const bar: Cell[] = [[0, 0, 0], [1, 0, 0], [2, 0, 0]];
  const spots = [{ dx: 5, dy: 5 }, { dx: 6, dy: 5 }];
  const shown = { ...draft, spot: { dx: 5, dy: 5 } };
  assert.deepEqual(spotAt(bar, [6, 5, 0], shown, spots), { dx: 6, dy: 5 });
  assert.deepEqual(spotAt(bar, [7, 5, 0], shown, spots), { dx: 5, dy: 5 });
  assert.deepEqual(spotAt(bar, [8, 5, 0], shown, spots), { dx: 6, dy: 5 });
  assert.equal(spotAt(bar, [9, 5, 0], shown, spots), null);
});
