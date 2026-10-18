import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, ROUTES, ROUTE_POINTS, TICKETS } from './map.ts';
import { CARDS_PER_COLOR, LOCOMOTIVES, TRAIN_COLORS, fullDeck } from './cards.ts';

const pairKey = (a: number, b: number) => [a, b].sort((x, y) => x - y).join('-');

test('the USA map has 36 cities and 100 tracks over 78 city pairs', () => {
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
  assert.deepEqual([TICKETS[29].a, TICKETS[29].b].map(id => CITIES[id].name), ['Winnipeg', 'Little Rock']);
});

test('110 train cards: 12 of each of the 8 colors and 14 locomotives', () => {
  const deck = fullDeck();
  assert.equal(deck.length, 110);
  for (const color of TRAIN_COLORS) assert.equal(deck.filter(card => card === color).length, CARDS_PER_COLOR);
  assert.equal(deck.filter(card => card === 'locomotive').length, LOCOMOTIVES);
});
