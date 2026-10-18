import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canReturnToRack, clickTile, heldTiles, moveTo as move, placeHeld, rackOrder, resetDraft, sortRack, splitGroup } from './draft.ts';
import { COLORS, JOKERS } from '../rules.ts';
import type { TileColor } from '../types.ts';

// The new draft, or the error
function moveTo(...args: Parameters<typeof move>) {
  const result = move(...args);
  return 'state' in result ? result.state : result;
}

function t(color: TileColor, value: number, copy = 0): number {
  return copy * 52 + COLORS.indexOf(color) * 13 + value - 1;
}

const r = (value: number) => t('red', value);
const draft = { table: [[r(1), r(2), r(3)], [r(5), r(6), r(7)]], rack: [r(4), t('blue', 9), r(8)] };
const committed = new Set(draft.table.flat());

test('a rack tile goes before a table tile, at the end of a group, or into a new group', () => {
  assert.deepEqual(moveTo(draft, { kind: 'tile', id: r(4) }, { kind: 'before', id: r(5) }, committed), {
    table: [[r(1), r(2), r(3)], [r(4), r(5), r(6), r(7)]], rack: [t('blue', 9), r(8)]
  });
  assert.deepEqual(moveTo(draft, { kind: 'tile', id: r(8) }, { kind: 'groupEnd', index: 1 }, committed), {
    table: [[r(1), r(2), r(3)], [r(5), r(6), r(7), r(8)]], rack: [r(4), t('blue', 9)]
  });
  assert.deepEqual(moveTo(draft, { kind: 'tile', id: t('blue', 9) }, { kind: 'newGroup' }, committed), {
    table: [[r(1), r(2), r(3)], [r(5), r(6), r(7)], [t('blue', 9)]], rack: [r(4), r(8)]
  });
});

test('a table tile moves between groups and an emptied group disappears', () => {
  const small = { table: [[r(1)], [r(2), r(3)]], rack: [] };
  assert.deepEqual(moveTo(small, { kind: 'tile', id: r(1) }, { kind: 'before', id: r(2) }, new Set()), {
    table: [[r(1), r(2), r(3)]], rack: []
  });
  // The group index is the one shown before the move, even when an earlier group empties
  assert.deepEqual(moveTo(small, { kind: 'tile', id: r(1) }, { kind: 'groupEnd', index: 1 }, new Set()), {
    table: [[r(2), r(3), r(1)]], rack: []
  });
});

test('a whole group merges into another', () => {
  assert.deepEqual(moveTo(draft, { kind: 'group', index: 1 }, { kind: 'groupEnd', index: 0 }, committed), {
    table: [[r(1), r(2), r(3), r(5), r(6), r(7)]], rack: draft.rack
  });
  assert.deepEqual(heldTiles(draft, { kind: 'group', index: 0 }), [r(1), r(2), r(3)]);
});

test('tiles from the table cannot go to the rack, but this turn\'s rack tiles can go back', () => {
  assert.deepEqual(moveTo(draft, { kind: 'tile', id: r(1) }, { kind: 'rack' }, committed), { error: 'Tiles from the table must stay on the table' });
  assert.deepEqual(moveTo(draft, { kind: 'group', index: 0 }, { kind: 'before', id: r(8) }, committed), { error: 'Tiles from the table must stay on the table' });
  const placed = { table: [[r(1), r(2), r(3), r(4)]], rack: [r(8)] };
  assert.deepEqual(moveTo(placed, { kind: 'tile', id: r(4) }, { kind: 'before', id: r(8) }, committed), {
    table: [[r(1), r(2), r(3)]], rack: [r(4), r(8)]
  });
  assert.deepEqual(moveTo(placed, { kind: 'tile', id: r(4) }, { kind: 'rack' }, committed), { table: [[r(1), r(2), r(3)]], rack: [r(8), r(4)] });
});

test('clicking picks a tile up, puts it in front of another, or puts it down; a refused drop keeps its message', () => {
  const idle = { draft, held: null, hint: null };
  const holding = clickTile(idle, r(4), committed, true);
  assert.deepEqual(holding.held, { kind: 'tile', id: r(4) });
  assert.deepEqual(clickTile(holding, r(4), committed, true), idle);
  const placed = clickTile(holding, r(5), committed, true);
  assert.deepEqual(placed.draft.table[1], [r(4), r(5), r(6), r(7)]);
  assert.equal(placed.held, null);

  // A table tile dropped in front of a rack tile is refused, and the message stays
  const refused = clickTile(clickTile(idle, r(1), committed, true), r(8), committed, true);
  assert.deepEqual(refused, { draft, held: null, hint: 'Tiles from the table must stay on the table' });

  // Off turn, rack tiles move about the rack but not onto the table
  const offTurn = clickTile(clickTile(idle, r(4), committed, false), r(5), committed, false);
  assert.equal(offTurn.hint, 'Wait for your turn to put tiles on the table');
  assert.deepEqual(clickTile(clickTile(idle, r(8), committed, false), r(4), committed, false).draft.rack, [r(8), r(4), t('blue', 9)]);
});

test('a group of this turn\'s own tiles can go back to the rack', () => {
  const own = { table: [[r(1), r(2), r(3)], [t('blue', 9), t('blue', 10), t('blue', 11)]], rack: [r(8)] };
  const held = { draft: own, held: { kind: 'group', index: 1 } as const, hint: null };
  assert.deepEqual(placeHeld(held, { kind: 'rack' }, committed, true).draft, {
    table: [[r(1), r(2), r(3)]], rack: [r(8), t('blue', 9), t('blue', 10), t('blue', 11)]
  });
  assert.equal(canReturnToRack(own, { kind: 'group', index: 1 }, committed), true);
  assert.equal(canReturnToRack(own, { kind: 'group', index: 0 }, committed), false);
});

test('dropping a tile on itself changes nothing', () => {
  assert.deepEqual(moveTo(draft, { kind: 'tile', id: r(2) }, { kind: 'before', id: r(2) }, committed), draft);
});

test('a group splits in two where asked', () => {
  assert.deepEqual(splitGroup(draft, 1, 1).table, [[r(1), r(2), r(3)], [r(5)], [r(6), r(7)]]);
  assert.deepEqual(splitGroup(draft, 1, 0), draft);
  assert.deepEqual(splitGroup(draft, 1, 3), draft);
});

test('reset puts the table back and returns this turn\'s tiles to the end of the rack', () => {
  const placed = { table: [[r(1), r(2), r(3), r(4)], [r(5), r(6), r(7)]], rack: [r(8), t('blue', 9)] };
  assert.deepEqual(resetDraft(draft.table, placed), { table: draft.table, rack: [r(8), t('blue', 9), r(4)] });
});

test('the rack keeps a remembered order and adds new tiles at the end', () => {
  assert.deepEqual(rackOrder([r(1), r(2), r(3)], [r(3), r(9), r(1)]), [r(3), r(1), r(2)]);
});

test('the rack sorts by color or by number, jokers last', () => {
  const rack = [JOKERS[0], t('red', 2), t('black', 5), t('blue', 2), t('black', 1)];
  assert.deepEqual(sortRack(rack, 'color'), [t('black', 1), t('black', 5), t('blue', 2), t('red', 2), JOKERS[0]]);
  assert.deepEqual(sortRack(rack, 'number'), [t('black', 1), t('blue', 2), t('red', 2), t('black', 5), JOKERS[0]]);
});
