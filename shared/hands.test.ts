import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handCounts, mapSeats, viewHand } from './hands.ts';

const hands = { 2: ['b1', 'b2'], 1: ['a1'] };

test('viewer null sees no hand', () => {
  assert.deepEqual(viewHand(hands, null), []);
});

test('a seat with no hand sees an empty one', () => {
  assert.deepEqual(viewHand(hands, 3), []);
});

test('a viewer sees only their own hand', () => {
  assert.deepEqual(viewHand(hands, 2), ['b1', 'b2']);
});

test('counts list every seat', () => {
  assert.equal(JSON.stringify(handCounts<string>({ 3: [], 1: ['a', 'b'], 2: ['c'] })), '{"1":2,"2":1,"3":0}');
});

test('mapSeats passes the seat', () => {
  assert.deepEqual(mapSeats({ 1: 10, 3: 30 }, (value, seat) => value + seat), { 1: 11, 3: 33 });
});
