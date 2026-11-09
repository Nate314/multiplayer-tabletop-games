import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seeded } from '../testStates.ts';
import { COMMODITIES } from './cards.ts';
import { applyAction, createGameState, privateSeatView, resetLobby, toPublicState } from './rules.ts';
import type { Card, GameState, Seat } from './types.ts';

function lobby(): GameState {
  return resetLobby({
    ...createGameState('g1'),
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' }
  }, seeded(3));
}

function act(state: GameState, seat: Seat, action: unknown): GameState {
  const result = applyAction(state, seat, action, seeded(9));
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const ids = (hand: Card[]) => hand.map(card => card.id);
const views = (state: GameState) => [null, 1, 2, 3].map(viewer => toPublicState(state, false, viewer));

// Alice and Bob each offer 2 cards of their first card's commodity
function offering(): GameState {
  let state = lobby();
  for (const seat of [1, 2]) {
    const hand = state.hands[seat]!;
    state = act(state, seat, { type: 'offer', cards: ids(hand.filter(card => card.kind === hand[0].kind).slice(0, 2)) });
  }
  return state;
}

test('a player sees only their own hand and own offered cards', () => {
  const state = offering();
  const mine = toPublicState(state, false, 1);
  assert.deepEqual(mine.hand, state.hands[1]);
  assert.deepEqual(mine.offering, state.offers.find(o => o.seat === 1)!.cards);
  assert.deepEqual(privateSeatView(state, 1), { hand: mine.hand, offering: mine.offering });
  const theirs = JSON.stringify(toPublicState(state, false, 2));
  for (const id of ids(state.hands[1]!)) assert.ok(!theirs.includes(`"id":${id},"kind"`), `card ${id} leaked`);
  const table = toPublicState(state, false, null);
  assert.deepEqual(table.hand, []);
  assert.deepEqual(table.offering, []);
  assert.deepEqual(table.handCounts, { 1: 9, 2: 9, 3: 9 });
  for (const view of views(state)) assert.ok(!('hands' in view));
  // After a swap each player sees only their own new cards, and lastMove names none
  const swapped = act(state, 2, { type: 'accept', offer: state.offers.find(o => o.seat === 1)!.id });
  for (const view of views(swapped)) assert.deepEqual(view.lastMove, { type: 'swap', seats: [2, 1], count: 2 });
  for (const seat of [1, 2]) assert.deepEqual(toPublicState(swapped, false, seat).hand, swapped.hands[seat]);
  const cara = JSON.stringify(toPublicState(swapped, false, 3));
  for (const id of ids([...swapped.hands[1]!, ...swapped.hands[2]!])) assert.ok(!cara.includes(`"id":${id},"kind"`), `card ${id} leaked`);
  assert.deepEqual(toPublicState(swapped, false, null).hand, []);
});

test('no view names the commodities in an open offer', () => {
  const state = offering();
  for (const view of views(state)) {
    const text = JSON.stringify(view.offers);
    for (const { kind, name } of COMMODITIES) assert.ok(!text.includes(kind) && !text.includes(name), `${kind} in offers`);
    assert.deepEqual(view.offers.map(o => Object.keys(o).sort()), [['count', 'id', 'seat'], ['count', 'id', 'seat']]);
  }
  const swapped = act(state, 2, { type: 'accept', offer: state.offers.find(o => o.seat === 1)!.id });
  for (const view of views(swapped)) {
    for (const { kind } of COMMODITIES) assert.ok(!JSON.stringify(view.lastMove).includes(kind));
  }
});

test('the summary shows the cornering hand to everyone', () => {
  const base = lobby();
  const hand: Card[] = Array.from({ length: 9 }, (_, i) => ({ id: 500 + i, kind: 'saffron' }));
  const state = act({ ...base, hands: { ...base.hands, 2: hand } }, 2, { type: 'corner' });
  for (const view of views(state)) assert.deepEqual(view.summary?.hand, hand);
});
