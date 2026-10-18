import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_TILE, TILES, TILE_TYPES, drawTiles, edgeAt, facingHalf, turnHalf, turnSide } from './tiles.ts';
import type { Side } from './types.ts';

const SIDES: Side[] = [0, 1, 2, 3];

test('72 tiles in the published counts, the start tile included', () => {
  const counts = Object.fromEntries(TILE_TYPES.map(type => [type, TILES[type].count]));
  assert.deepEqual(counts, {
    A: 2, B: 4, C: 1, D: 4, E: 5, F: 2, G: 1, H: 3, I: 2, J: 3, K: 3, L: 3,
    M: 2, N: 3, O: 2, P: 3, Q: 1, R: 3, S: 2, T: 1, U: 8, V: 9, W: 4, X: 1
  });
  assert.equal(TILE_TYPES.reduce((sum, type) => sum + TILES[type].count, 0), 72);
  assert.equal(drawTiles().length, 71);
  assert.equal(drawTiles().filter(type => type === START_TILE).length, 3);
});

test('10 pennants, 6 monasteries, and the start tile is a city over a straight road', () => {
  const total = (count: (type: (typeof TILE_TYPES)[number]) => number) => TILE_TYPES.reduce((sum, type) => sum + count(type) * TILES[type].count, 0);
  assert.equal(total(type => TILES[type].cities.filter(city => city.pennant).length), 10);
  assert.equal(total(type => (TILES[type].monastery ? 1 : 0)), 6);
  assert.deepEqual(TILES[START_TILE].edges, ['city', 'road', 'field', 'road']);
});

test('every edge belongs to exactly one feature of its kind', () => {
  for (const type of TILE_TYPES) {
    const tile = TILES[type];
    for (const side of SIDES) {
      const edge = tile.edges[side];
      const cities = tile.cities.filter(city => city.sides.includes(side)).length;
      const roads = tile.roads.filter(road => road.sides.includes(side)).length;
      assert.equal(cities, edge === 'city' ? 1 : 0, `${type} side ${side} cities`);
      assert.equal(roads, edge === 'road' ? 1 : 0, `${type} side ${side} roads`);
      for (const half of [2 * side, 2 * side + 1]) {
        const fields = tile.fields.filter(field => field.halves.includes(half)).length;
        assert.equal(fields, edge === 'city' ? 0 : 1, `${type} half ${half} fields`);
      }
    }
  }
});

test('features are well formed', () => {
  for (const type of TILE_TYPES) {
    const tile = TILES[type];
    for (const field of tile.fields) {
      assert.ok(field.halves.length > 0, `${type} has an empty field`);
      for (const city of field.cities) assert.ok(city >= 0 && city < tile.cities.length, `${type} field borders a missing city`);
    }
    // A road's two halves are in different fields, unless the road ends on the tile (one side)
    for (const road of tile.roads) {
      if (road.sides.length !== 2) continue;
      for (const side of road.sides) {
        const left = tile.fields.findIndex(field => field.halves.includes(2 * side));
        const right = tile.fields.findIndex(field => field.halves.includes(2 * side + 1));
        assert.notEqual(left, right, `${type} road side ${side} does not split its field`);
      }
    }
    // Every city borders some field, unless the tile is all city
    if (tile.fields.length > 0) {
      tile.cities.forEach((_, index) => assert.ok(tile.fields.some(field => field.cities.includes(index)), `${type} city ${index} borders no field`));
    }
    // A field edge has both halves in the same field
    for (const side of SIDES) {
      if (tile.edges[side] !== 'field') continue;
      const left = tile.fields.findIndex(field => field.halves.includes(2 * side));
      assert.ok(tile.fields[left].halves.includes(2 * side + 1), `${type} field side ${side} is split`);
    }
  }
});

test('turning a tile moves its sides and half-edges together', () => {
  assert.equal(turnSide(0, 1), 1);
  assert.equal(turnSide(3, 1), 0);
  assert.equal(turnSide(1, -1), 0);
  assert.equal(turnHalf(0, 1), 2);
  assert.equal(turnHalf(7, 1), 1);
  assert.equal(edgeAt('E', 0, 0), 'city');
  assert.equal(edgeAt('E', 1, 1), 'city');
  assert.equal(edgeAt('E', 1, 0), 'field');
  assert.equal(edgeAt('E', 3, 3), 'city');
});

test('a half-edge faces the other half of the opposite side', () => {
  assert.equal(facingHalf(0), 5);
  assert.equal(facingHalf(1), 4);
  assert.equal(facingHalf(2), 7);
  assert.equal(facingHalf(3), 6);
  for (let half = 0; half < 8; half++) assert.equal(facingHalf(facingHalf(half)), half);
});
