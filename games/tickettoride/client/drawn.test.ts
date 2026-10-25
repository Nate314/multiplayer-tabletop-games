import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawnStep } from './drawn.ts';
import { toPublicState } from '../rules.ts';
import { game, hand, played, routeBetween } from '../testing.ts';
import type { GameState, PublicGameState, Seat } from '../types.ts';

const view = (state: GameState, viewer: Seat, moveCount = 0): PublicGameState =>
  ({ ...toPublicState(state, false, viewer), moveCount });

// Alice's first card is a blind red, her second the face-up blue
const firstCard = () => {
  const before = game();
  return { before, first: played(before, 1, { type: 'drawCard', source: 'deck' }) };
};

test('both cards of a draw stay outlined', () => {
  const { before, first } = firstCard();
  assert.deepEqual(drawnStep(view(before, 1), view(first, 1), 1), { add: ['red'], clear: true });
  const second = played(first, 1, { type: 'drawCard', source: 0 });
  assert.deepEqual(drawnStep(view(first, 1), view(second, 1), 1), { add: ['blue'], clear: false });
});

test('a second card of the same color keeps the first outlined', () => {
  const { first } = firstCard();
  const second = played(first, 1, { type: 'drawCard', source: 'deck' });
  assert.equal(second.players[1].hand.red, 2);
  assert.deepEqual(drawnStep(view(first, 1), view(second, 1), 1), { add: ['red'], clear: false });
});

test('claiming a route clears them', () => {
  const route = routeBetween('Vancouver', 'Seattle');
  const before = game({}, { 1: { hand: hand({ red: 2, blue: 2 }) } });
  const claimed = played(before, 1, { type: 'claim', route: route.id, payment: { color: 'red', locomotives: 0 } });
  assert.deepEqual(drawnStep(view(before, 1), view(claimed, 1), 1), { add: [], clear: true });
});

test("another player's draw changes nothing", () => {
  const before = game({ currentPlayer: 2 });
  const next = played(before, 2, { type: 'drawCard', source: 'deck' });
  assert.deepEqual(drawnStep(view(before, 1), view(next, 1), 1), { add: [], clear: false });
});
