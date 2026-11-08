import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_CARDS, BORDERS, CONTINENTS, NEIGHBORS, TERRITORIES, cardSymbol, cardTerritory, territoriesOf, territoryName } from './map.ts';

test('42 territories with unique ids and names, inside the drawn map', () => {
  assert.equal(TERRITORIES.length, 42);
  assert.equal(new Set(TERRITORIES.map(({ id }) => id)).size, 42);
  assert.equal(new Set(TERRITORIES.map(({ name }) => name)).size, 42);
  for (const { x, y } of TERRITORIES) assert.ok(x > 0 && x < 1000 && y > 0 && y < 620);
});

test('continents keep the published sizes and bonuses, in order', () => {
  assert.deepEqual(CONTINENTS.map(c => [territoriesOf(c.id).length, c.bonus]), [[9, 5], [4, 2], [7, 5], [6, 3], [12, 7], [4, 2]]);
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

test('each continent is as easy to hold as before', () => {
  const crossing = CONTINENTS.map(({ id }) => {
    const inside = new Set(territoriesOf(id));
    const borders = BORDERS.filter(({ a, b }) => inside.has(a) !== inside.has(b));
    return [borders.length, new Set(borders.flatMap(({ a, b }) => [a, b]).filter(each => inside.has(each))).size];
  });
  assert.deepEqual(crossing.map(([borders]) => borders), [3, 2, 8, 6, 8, 1]);
  assert.deepEqual(crossing.map(([, onEdge]) => onEdge), [3, 2, 4, 3, 5, 1]);
  assert.equal(BORDERS.filter(({ sea }) => sea).length, 23);
  for (const [id, neighbors] of Object.entries(NEIGHBORS)) assert.ok(neighbors.length >= 2 && neighbors.length <= 6, id);
});

// The published map's continent and territory names and ids
const OLD_NAMES = [
  'northAmerica', 'North America', 'southAmerica', 'South America', 'europe', 'Europe', 'africa', 'Africa', 'asia',
  'Asia', 'australia', 'Australia', 'alaska', 'Alaska', 'northwestTerritory', 'Northwest Territory', 'greenland',
  'Greenland', 'alberta', 'Alberta', 'ontario', 'Ontario', 'quebec', 'Quebec', 'westernUnitedStates',
  'Western United States', 'easternUnitedStates', 'Eastern United States', 'centralAmerica', 'Central America',
  'venezuela', 'Venezuela', 'peru', 'Peru', 'brazil', 'Brazil', 'argentina', 'Argentina', 'iceland', 'Iceland',
  'scandinavia', 'Scandinavia', 'greatBritain', 'Great Britain', 'northernEurope', 'Northern Europe', 'ukraine',
  'Ukraine', 'westernEurope', 'Western Europe', 'southernEurope', 'Southern Europe', 'northAfrica', 'North Africa',
  'egypt', 'Egypt', 'eastAfrica', 'East Africa', 'congo', 'Congo', 'southAfrica', 'South Africa', 'madagascar',
  'Madagascar', 'ural', 'Ural', 'siberia', 'Siberia', 'yakutsk', 'Yakutsk', 'kamchatka', 'Kamchatka', 'irkutsk',
  'Irkutsk', 'mongolia', 'Mongolia', 'japan', 'Japan', 'afghanistan', 'Afghanistan', 'china', 'China', 'middleEast',
  'Middle East', 'india', 'India', 'siam', 'Siam', 'indonesia', 'Indonesia', 'newGuinea', 'New Guinea',
  'westernAustralia', 'Western Australia', 'easternAustralia', 'Eastern Australia'
];

test('a fictional world', () => {
  for (const { id, name } of [...CONTINENTS, ...TERRITORIES]) {
    assert.ok(!OLD_NAMES.includes(id), id);
    assert.ok(!OLD_NAMES.includes(name), name);
  }
});

test('every card names a territory', () => {
  for (let card = 0; card < 42; card++) assert.equal(territoryName(cardTerritory(card)!), TERRITORIES[card].name);
});

test('the world is connected', () => {
  const seen = new Set([TERRITORIES[0].id]);
  const queue = [TERRITORIES[0].id];
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
