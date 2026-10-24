import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawnStep } from './drawn.ts';
import { createGameState, toPublicState } from '../rules.ts';
import { skipbo } from '../index.ts';
import { applyMove } from '../../../shared/seating.ts';
import type { Card, GameState, PublicGameState, Result, Seat } from '../types.ts';

let nextId = 1000;
const num = (value: number): Card => ({ id: nextId++, kind: 'number', value });
const nums = (...values: number[]) => values.map(num);
const emptyPiles = (): Card[][] => [[], [], [], []];

// Alice to play with her turn set up; the draw pile is drawn from its end
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g1'),
    started: true,
    currentPlayer: 1,
    turnOf: 1,
    activePlayers: [1, 2],
    playerNames: { 1: 'Alice', 2: 'Bob' },
    hands: { 1: nums(5, 6, 7), 2: nums(3, 4) },
    stocks: { 1: nums(10, 1), 2: nums(10, 11) },
    discards: { 1: emptyPiles(), 2: emptyPiles() },
    building: emptyPiles(),
    drawPile: nums(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12),
    ...overrides
  };
}

function after(state: GameState, seat: Seat, made: object): GameState {
  const result: Result<GameState> = applyMove(skipbo, state, seat, made, () => 0.5);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const view = (state: GameState, viewer: Seat, moveCount = 0): PublicGameState =>
  ({ ...toPublicState(state, false, viewer), moveCount });
const ids = (cards: Card[]) => cards.map(card => card.id);

test('the cards dealt for your turn are outlined', () => {
  const before = game();
  const next = after(before, 1, { type: 'discard', handIndex: 0, pile: 0 });
  assert.equal(next.hands[2].length, 5);
  assert.deepEqual(drawnStep(view(before, 2), view(next, 2), 2), { add: ids(next.hands[2].slice(2)), clear: false });
});

test('refilling an emptied hand mid-turn outlines the new cards', () => {
  const before = game({ hands: { 1: nums(1), 2: nums(3, 4) } });
  const next = after(before, 1, { type: 'play', from: { kind: 'hand', index: 0 }, to: 0 });
  assert.equal(next.hands[1].length, 5);
  assert.deepEqual(drawnStep(view(before, 1), view(next, 1), 1), { add: ids(next.hands[1]), clear: false });
});

test('your discard clears them', () => {
  const before = game();
  const next = after(before, 1, { type: 'discard', handIndex: 0, pile: 0 });
  assert.deepEqual(drawnStep(view(before, 1), view(next, 1), 1), { add: [], clear: true });
});

test('ending your turn with an empty hand clears them', () => {
  const before = game({ hands: { 1: [], 2: nums(3, 4) }, drawPile: [] });
  const next = after(before, 1, { type: 'endTurn' });
  assert.deepEqual(drawnStep(view(before, 1), view(next, 1), 1), { add: [], clear: true });
});

test('a play that does not refill changes nothing', () => {
  const before = game();
  const next = after(before, 1, { type: 'play', from: { kind: 'stock' }, to: 0 });
  assert.deepEqual(drawnStep(view(before, 1), view(next, 1), 1), { add: [], clear: false });
});
