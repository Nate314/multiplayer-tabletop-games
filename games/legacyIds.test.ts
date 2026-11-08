import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from './registry.ts';
import { currentId, keepsSaves, LEGACY_IDS, type LegacyIds } from './legacyIds.ts';

const TEST: LegacyIds = { oldgame: { id: 'newgame', keepsSaves: true }, oldmap: { id: 'newmap', keepsSaves: false } };

test('currentId maps an old id and leaves others', () => {
  assert.equal(currentId('oldgame', TEST), 'newgame');
  assert.equal(currentId('newgame', TEST), 'newgame');
  assert.equal(currentId('chess', TEST), 'chess');
});

test('currentId ignores the object prototype', () => {
  for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    assert.equal(currentId(name, TEST), name);
  }
});

test('keepsSaves is false only for a reshaped old id', () => {
  assert.equal(keepsSaves('oldgame', TEST), true);
  assert.equal(keepsSaves('oldmap', TEST), false);
  assert.equal(keepsSaves('chess', TEST), true);
  assert.equal(keepsSaves('constructor', TEST), true);
});

test('every legacy entry points at a registered game and no old id is still registered', () => {
  for (const [old, { id }] of Object.entries(LEGACY_IDS)) {
    assert.ok(GAMES.some(g => g.info.id === id), `${old} -> ${id} is not registered`);
    assert.ok(!GAMES.some(g => g.info.id === old), `${old} is still registered`);
    assert.notEqual(old, id);
    assert.ok(!Object.hasOwn(LEGACY_IDS, id), `${old} chains through ${id}`);
  }
});

test('monopoly is now Street Deeds and its saves still fit', () => {
  assert.equal(currentId('monopoly'), 'streetdeeds');
  assert.equal(keepsSaves('monopoly'), true);
});

test('tickettoride is now Rail Routes and its saves are refused', () => {
  assert.equal(currentId('tickettoride'), 'railroutes');
  assert.equal(keepsSaves('tickettoride'), false);
});

// Chunk 11's renames: every old id points at its renamed game, and no old id is still registered
const CHUNK_11: Record<string, string> = { azul: 'palacewalls', carcassonne: 'roadsandfields', catan: 'hexisland', connectfour: 'fourinarow', jenga: 'blocktower', parchisi: 'pachisi', quoridor: 'pawnsandwalls', rummikub: 'rummytiles', scrabble: 'lettergrid', splendor: 'jewelguild' };
test('chunk 11 old ids map to their renamed games', () => {
  for (const [old, id] of Object.entries(CHUNK_11)) {
    assert.deepEqual(LEGACY_IDS[old], { id, keepsSaves: true }, old);
    assert.ok(GAMES.some(game => game.info.id === id), id);
    assert.ok(!GAMES.some(game => game.info.id === old), old);
  }
});

// Chunk 12's renames: every old id points at a registered game that keeps its saves, and no old id is still registered
const CHUNK_12: Record<string, string> = { phase10: 'stagerummy', pictionary: 'drawandguess', racko: 'inorder', rook: 'nest', skipbo: 'spiteandmalice', uno: 'rainboweights', yahtzee: 'fivedice' };
test('chunk 12 old ids map to their renamed games', () => {
  for (const [old, id] of Object.entries(CHUNK_12)) {
    assert.equal(LEGACY_IDS[old]?.id, id, old);
    assert.equal(LEGACY_IDS[old]?.keepsSaves, true, old);
    assert.ok(GAMES.some(game => game.info.id === id), id);
    assert.ok(!GAMES.some(game => game.info.id === old), old);
  }
});

test('thecrew is now Mission Tricks and its saves still fit', () => {
  assert.equal(currentId('thecrew'), 'missiontricks');
  assert.equal(keepsSaves('thecrew'), true);
});

test('risk is now Territories and its saves are refused', () => {
  assert.equal(currentId('risk'), 'territories');
  assert.equal(keepsSaves('risk'), false);
});
