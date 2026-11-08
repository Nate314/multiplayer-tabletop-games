import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys, stepsOf } from '../../server/testing.ts';
import { seeded } from '../testStates.ts';
import { tradingfloor } from './index.ts';
import type { Card, Commodity, GameState, Seat } from './types.ts';
import type { Result } from '../../shared/types.ts';

const ROOM = 'tradingfloor/g1';
const KINDS: Commodity[] = ['saffron', 'silver', 'coffee'];

// Three seats, each holding nine of its own commodity (ids 0-8, 9-17, 18-26), so every hand is known
function table() {
  const manager = rememberingKeys(createGameManager([tradingfloor], seeded(42)));
  for (const name of ['Alice', 'Bob', 'Cleo']) manager.join('tradingfloor', 'g1', name);
  agreeAll(manager, ROOM);
  const raw = () => manager.rawState(ROOM) as unknown as GameState;
  raw().hands = Object.fromEntries(KINDS.map((kind, i): [number, Card[]] =>
    [i + 1, Array.from({ length: 9 }, (_, n) => ({ id: i * 9 + n, kind }))]));
  const act = (seat: Seat, action: object) => manager.action(ROOM, seat, action);
  const offer = (seat: Seat, count: number, from = 0) =>
    ok(act(seat, { type: 'offer', cards: raw().hands[seat]!.slice(from, from + count).map(card => card.id) }));
  const idOf = (seat: Seat) => raw().offers.find(o => o.seat === seat)!.id;
  const steps = () => stepsOf(manager, 'tradingfloor')!;
  return { manager, raw, act, offer, idOf, steps };
}

function ok(result: Result<unknown>): void {
  if ('error' in result) assert.fail(result.error);
}

test('two accepts of one offer: the first swaps, the second is already taken and keeps its offer', () => {
  const { raw, act, offer, idOf } = table();
  offer(2, 2);
  offer(3, 2);
  offer(1, 2);
  const taken = idOf(2);
  const seat3Hand = raw().hands[3];
  const seat1Hand = raw().hands[1];
  ok(act(1, { type: 'accept', offer: taken }));
  assert.deepEqual(act(3, { type: 'accept', offer: taken }), { error: 'Already taken' });
  assert.ok(raw().offers.some(o => o.seat === 3));
  assert.equal(raw().hands[3], seat3Hand);
  assert.notEqual(raw().hands[1], seat1Hand);
});

test('offers are not History steps, swaps and corners are', () => {
  const { act, offer, idOf, steps } = table();
  const start = steps().length;
  offer(1, 2);
  offer(2, 2);
  ok(act(2, { type: 'withdraw' }));
  offer(2, 2);
  assert.equal(steps().length, start);
  ok(act(2, { type: 'accept', offer: idOf(1) }));
  assert.equal(steps().length, start + 1);
  ok(act(3, { type: 'corner' }));
  assert.equal(steps().length, start + 2);
});

test('no history step shows a hand', () => {
  const { act, offer, idOf, steps } = table();
  offer(1, 2);
  offer(2, 2);
  ok(act(2, { type: 'accept', offer: idOf(1) }));
  offer(3, 1);
  ok(act(3, { type: 'corner' }));
  const all = steps();
  assert.ok(all.length >= 2);
  for (const step of all) {
    const view = step as unknown as { hand: Card[]; offers: object[] };
    assert.deepEqual(view.hand, []);
    assert.ok(view.offers.every(o => !('cards' in o)));
  }
});

test('an action from a seat that offered a moment ago is never refused as stale', () => {
  const { act, offer, idOf } = table();
  offer(1, 2);
  offer(2, 2);
  ok(act(2, { type: 'accept', offer: idOf(1) }));
});

test('requesting undo is refused', () => {
  const { manager, offer, idOf, act } = table();
  offer(1, 2);
  offer(2, 2);
  ok(act(2, { type: 'accept', offer: idOf(1) }));
  assert.ok('error' in manager.requestUndo(ROOM, 2));
});
