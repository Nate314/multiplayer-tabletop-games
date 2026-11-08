import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_CARDS, BORDERS, CONTINENTS, NEIGHBORS, TERRITORIES, adjacent, cardSymbol, territoriesOf } from './map.ts';

test('42 territories with unique ids and names, inside the drawn map', () => {
  assert.equal(TERRITORIES.length, 42);
  assert.equal(new Set(TERRITORIES.map(({ id }) => id)).size, 42);
  assert.equal(new Set(TERRITORIES.map(({ name }) => name)).size, 42);
  for (const { x, y } of TERRITORIES) assert.ok(x > 0 && x < 1000 && y > 0 && y < 620);
});

test('continents have their published territory counts and bonuses', () => {
  const expected = { northAmerica: [9, 5], southAmerica: [4, 2], europe: [7, 5], africa: [6, 3], asia: [12, 7], australia: [4, 2] };
  assert.equal(CONTINENTS.length, 6);
  for (const { id, bonus } of CONTINENTS) assert.deepEqual([territoriesOf(id).length, bonus], expected[id]);
  assert.ok(TERRITORIES.every(({ continent }) => CONTINENTS.some(({ id }) => id === continent)));
});

test('83 borders, each listed once, between real territories, and symmetric', () => {
  assert.equal(BORDERS.length, 83);
  const keys = BORDERS.map(({ a, b }) => [a, b].sort().join('|'));
  assert.equal(new Set(keys).size, 83);
  for (const { a, b } of BORDERS) {
    assert.notEqual(a, b);
    assert.ok(a in NEIGHBORS && b in NEIGHBORS, `${a} or ${b} is not a territory`);
  }
  for (const [id, neighbors] of Object.entries(NEIGHBORS)) {
    for (const neighbor of neighbors) assert.ok(NEIGHBORS[neighbor].includes(id), `${neighbor} does not list ${id}`);
  }
});

test('the borders players know: the Bering Strait, the Atlantic and the way into Australia', () => {
  assert.ok(adjacent('alaska', 'kamchatka'));
  assert.ok(adjacent('brazil', 'northAfrica'));
  assert.ok(adjacent('greenland', 'iceland'));
  assert.ok(adjacent('eastAfrica', 'middleEast'));
  assert.ok(adjacent('siam', 'indonesia'));
  assert.equal(adjacent('india', 'indonesia'), false);
  assert.equal(adjacent('alaska', 'greenland'), false);
  // Australia has one way in, South America two
  const entrances = (continent: 'australia' | 'southAmerica') => BORDERS.filter(({ a, b }) => {
    const inside = territoriesOf(continent);
    return inside.includes(a) !== inside.includes(b);
  }).length;
  assert.equal(entrances('australia'), 1);
  assert.equal(entrances('southAmerica'), 2);
  assert.deepEqual([...NEIGHBORS.ontario].sort(), ['alberta', 'easternUnitedStates', 'greenland', 'northwestTerritory', 'quebec', 'westernUnitedStates']);
});

test('the world is connected', () => {
  const seen = new Set(['alaska']);
  const queue = ['alaska'];
  while (queue.length > 0) {
    for (const next of NEIGHBORS[queue.shift()!]) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  assert.equal(seen.size, 42);
});

test('44 cards: 14 of each symbol and 2 wilds', () => {
  assert.equal(ALL_CARDS.length, 44);
  const counts: Record<string, number> = {};
  for (const card of ALL_CARDS) counts[cardSymbol(card)] = (counts[cardSymbol(card)] ?? 0) + 1;
  assert.deepEqual(counts, { infantry: 14, cavalry: 14, artillery: 14, wild: 2 });
});
