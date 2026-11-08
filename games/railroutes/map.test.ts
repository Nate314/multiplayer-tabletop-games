import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, ROUTES, ROUTE_POINTS, TICKETS, shortestTrack } from './map.ts';
import { CARDS_PER_COLOR, LOCOMOTIVES, TRAIN_COLORS, fullDeck } from './cards.ts';

const pairKey = (a: number, b: number) => [a, b].sort((x, y) => x - y).join('-');

test('the map has 36 cities and 100 tracks over 78 city pairs', () => {
  assert.equal(CITIES.length, 36);
  assert.equal(new Set(CITIES.map(city => city.name)).size, 36);
  assert.equal(ROUTES.length, 100);
  assert.equal(new Set(ROUTES.map(route => pairKey(route.a, route.b))).size, 78);
  assert.ok(ROUTES.every((route, index) => route.id === index && route.a !== route.b));
});

test('the tracks hold 309 train spaces with the published spread of lengths', () => {
  assert.equal(ROUTES.reduce((total, route) => total + route.length, 0), 309);
  const byLength = (length: number) => ROUTES.filter(route => route.length === length).length;
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(byLength), [9, 36, 20, 16, 10, 9]);
  assert.equal(ROUTES.reduce((total, route) => total + ROUTE_POINTS[route.length], 0), 508);
  assert.equal(ROUTES.filter(route => route.color === 'gray').length, 44);
  for (const color of TRAIN_COLORS) assert.ok(ROUTES.some(route => route.color === color), color);
});

test('there are 22 double routes, each two tracks of the same length that name each other', () => {
  const doubles = ROUTES.filter(route => route.twin !== null);
  assert.equal(doubles.length, 44);
  for (const route of doubles) {
    const twin = ROUTES[route.twin as number];
    assert.equal(twin.twin, route.id);
    assert.equal(pairKey(twin.a, twin.b), pairKey(route.a, route.b));
    assert.equal(twin.length, route.length);
    // Colored double routes are always two different colors
    if (route.color !== 'gray') assert.notEqual(twin.color, route.color);
  }
  const pairs = new Map<string, number>();
  for (const route of ROUTES) pairs.set(pairKey(route.a, route.b), (pairs.get(pairKey(route.a, route.b)) ?? 0) + 1);
  assert.equal([...pairs.values()].filter(count => count === 2).length, 22);
  assert.ok([...pairs.values()].every(count => count <= 2));
});

test('every city can be reached from every other', () => {
  const reached = new Set([0]);
  const queue = [0];
  while (queue.length > 0) {
    const city = queue.pop() as number;
    for (const route of ROUTES) {
      const other = route.a === city ? route.b : route.b === city ? route.a : null;
      if (other !== null && !reached.has(other)) {
        reached.add(other);
        queue.push(other);
      }
    }
  }
  assert.equal(reached.size, 36);
  assert.ok(CITIES.every(city => ROUTES.filter(route => route.a === city.id || route.b === city.id).length >= 2));
});

test('the 30 destination tickets, from 4 to 22 points', () => {
  assert.equal(TICKETS.length, 30);
  assert.equal(TICKETS.reduce((total, ticket) => total + ticket.points, 0), 349);
  assert.equal(Math.min(...TICKETS.map(ticket => ticket.points)), 4);
  assert.equal(Math.max(...TICKETS.map(ticket => ticket.points)), 22);
  assert.equal(new Set(TICKETS.map(ticket => pairKey(ticket.a, ticket.b))).size, 30);
});

test('the same totals as the published map', () => {
  assert.equal(CITIES.length, 36);
  assert.equal(new Set(CITIES.map(city => city.name)).size, 36);
  assert.equal(ROUTES.length, 100);
  assert.equal(new Set(ROUTES.map(route => pairKey(route.a, route.b))).size, 78);
  assert.equal(ROUTES.filter(route => route.twin !== null).length / 2, 22);
  assert.equal(ROUTES.reduce((total, route) => total + route.length, 0), 309);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(length => ROUTES.filter(route => route.length === length).length), [9, 36, 20, 16, 10, 9]);
  assert.equal(ROUTES.reduce((total, route) => total + ROUTE_POINTS[route.length], 0), 508);
  const routes: Record<string, number> = {};
  const spaces: Record<string, number> = {};
  for (const route of ROUTES) {
    routes[route.color] = (routes[route.color] ?? 0) + 1;
    spaces[route.color] = (spaces[route.color] ?? 0) + route.length;
  }
  assert.deepEqual(routes, { gray: 44, pink: 7, white: 7, blue: 7, yellow: 7, orange: 7, black: 7, red: 7, green: 7 });
  assert.equal(spaces.gray, 93);
  for (const color of TRAIN_COLORS) assert.equal(spaces[color], 27, color);
});

test('tickets keep the published point spread', () => {
  assert.deepEqual(TICKETS.map(ticket => ticket.points).sort((a, b) => a - b),
    [4, 5, 6, 7, 7, 8, 8, 8, 9, 9, 9, 9, 10, 10, 11, 11, 11, 11, 12, 12, 13, 13, 13, 16, 17, 17, 20, 20, 21, 22]);
  assert.equal(new Set(TICKETS.map(ticket => pairKey(ticket.a, ticket.b))).size, 30);
  assert.ok(TICKETS.every(ticket => ticket.a !== ticket.b));
});

test('every ticket is worth its shortest track', () => {
  for (const ticket of TICKETS) {
    assert.equal(ticket.points, shortestTrack(ticket.a, ticket.b), `${CITIES[ticket.a].name} to ${CITIES[ticket.b].name}`);
  }
  assert.equal(shortestTrack(0, 0), 0);
});

// The cities of the published map, none of which this map may use
const OLD_CITIES = [
  'Atlanta', 'Boston', 'Calgary', 'Charleston', 'Chicago', 'Dallas', 'Denver', 'Duluth', 'El Paso', 'Helena', 'Houston',
  'Kansas City', 'Las Vegas', 'Little Rock', 'Los Angeles', 'Miami', 'Montreal', 'Nashville', 'New Orleans', 'New York',
  'Oklahoma City', 'Omaha', 'Phoenix', 'Pittsburgh', 'Portland', 'Raleigh', 'Saint Louis', 'Salt Lake City', 'San Francisco',
  'Santa Fe', 'Sault St. Marie', 'Seattle', 'Toronto', 'Vancouver', 'Washington', 'Winnipeg'
];

test('a fictional continent', () => {
  assert.equal(OLD_CITIES.length, 36);
  for (const city of CITIES) assert.ok(!OLD_CITIES.includes(city.name), city.name);
});

test('110 train cards: 12 of each of the 8 colors and 14 locomotives', () => {
  const deck = fullDeck();
  assert.equal(deck.length, 110);
  for (const color of TRAIN_COLORS) assert.equal(deck.filter(card => card === color).length, CARDS_PER_COLOR);
  assert.equal(deck.filter(card => card === 'locomotive').length, LOCOMOTIVES);
});
