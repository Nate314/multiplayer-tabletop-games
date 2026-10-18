import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import { changedKeys } from './animateMove.ts';
import { routeSpaces } from './geometry.ts';
import { ROUTES } from '../map.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const say = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });

test('nothing to describe before the first move', () => {
  assert.equal(say(null), '');
});

test('a card drawn from the deck is never named', () => {
  assert.equal(say({ seat: 1, type: 'drawCard', card: null, second: false, marketReset: false }), 'Alice drew a card from the deck');
  assert.equal(say({ seat: 2, type: 'drawCard', card: 'red', second: true, marketReset: false }), 'Bob took a face-up red card');
  assert.equal(
    say({ seat: 2, type: 'drawCard', card: 'locomotive', second: false, marketReset: true }),
    'Bob took a face-up locomotive; three locomotives were face up, so all five were replaced'
  );
});

test('describes a claim with its payment', () => {
  const route = ROUTES.findIndex(candidate => candidate.length === 4 && candidate.color === 'pink');
  assert.equal(
    say({ seat: 1, type: 'claim', route, payment: { color: 'pink', locomotives: 1 } }),
    'Alice claimed Denver to Omaha (4, pink) with 3 pink and 1 locomotive'
  );
});

test('describes ticket draws and choices', () => {
  assert.equal(say({ seat: 1, type: 'drawTickets', count: 3 }), 'Alice drew 3 destination tickets');
  assert.equal(say({ seat: 1, type: 'keepTickets', kept: 2, returned: 1, initial: true }), 'Alice kept 2 destination tickets and returned 1');
  assert.equal(say({ seat: 2, type: 'keepTickets', kept: 1, returned: 0, initial: false }), 'Bob kept 1 destination ticket');
  assert.equal(say({ seat: 2, type: 'pass' }), 'Bob could do nothing and passed');
});

test('a claimed route and changed face-up slots fade in', () => {
  const previous = { faceUp: ['red', 'blue', 'green', 'black', 'white'] as const };
  const next = { faceUp: ['red', 'pink', 'green', 'black', 'white'] as const, lastMove: { seat: 1, type: 'claim', route: 7, payment: { color: null, locomotives: 2 } } as const };
  assert.deepEqual(changedKeys({ faceUp: [...previous.faceUp] }, { faceUp: [...next.faceUp], lastMove: next.lastMove }), ['route-7', 'slot-1']);
});

test('every route has one drawn space per train, inside the map', () => {
  for (const route of ROUTES) {
    const spaces = routeSpaces(route);
    assert.equal(spaces.length, route.length);
    assert.ok(spaces.every(space => space.length > 4 && space.x > 0 && space.x < 1060 && space.y > 0 && space.y < 630), String(route.id));
  }
});
