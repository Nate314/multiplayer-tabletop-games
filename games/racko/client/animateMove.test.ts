import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECK_KEY, DISCARD_KEY, HELD_KEY, slides, slotKey } from './animateMove.ts';
import { applyMove, createGameState, resetLobby, toPublicState } from '../rules.ts';
import type { GameState, PublicGameState, Result, Seat } from '../types.ts';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

// Alice (seat 1) to move with 1 to 10 except a 50 in slot 5 (index 4); the discard top is 5 and the draw pile ends in 40
function game(): GameState {
  const state = resetLobby({
    ...createGameState('g1'),
    activePlayers: [1, 2],
    playerNames: { 1: 'Alice', 2: 'Bob' },
    currentPlayer: 1
  }, () => 0.5);
  return {
    ...state,
    scores: { 1: 0, 2: 0 },
    racks: { 1: [1, 2, 3, 4, 50, 6, 7, 8, 9, 10], 2: range(11, 20) },
    drawPile: [60, 40],
    discardPile: [30, 5]
  };
}

function after(state: GameState, input: unknown, seat: Seat = state.currentPlayer ?? 1): GameState {
  const result: Result<GameState> = applyMove(state, seat, input, () => 0.5);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// What one player's browser holds, with the move count the animation hook counts
const view = (state: GameState, viewer: Seat, moveCount = 0): PublicGameState =>
  ({ ...toPublicState(state, false, viewer), moveCount });

test('a draw slides the card from its pile to the holding spot, for every player', () => {
  const before = game();
  const fromDeck = after(before, { type: 'draw', from: 'deck' });
  const fromDiscard = after(before, { type: 'draw', from: 'discard' });
  for (const viewer of [1, 2] as Seat[]) {
    assert.deepEqual(slides(view(before, viewer), view(fromDeck, viewer)), [[DECK_KEY, HELD_KEY]]);
    assert.deepEqual(slides(view(before, viewer), view(fromDiscard, viewer)), [[DISCARD_KEY, HELD_KEY]]);
  }
});

test('a swap slides the held card into the slot and the replaced card to the discard pile', () => {
  const held = after(game(), { type: 'draw', from: 'deck' });
  const next = after(held, { type: 'place', slot: 4 });
  for (const viewer of [1, 2] as Seat[]) {
    assert.deepEqual(slides(view(held, viewer), view(next, viewer)), [[HELD_KEY, slotKey(1, 4)], [slotKey(1, 4), DISCARD_KEY]]);
  }
});

test('discarding a card from the draw pile slides it from the holding spot to the discard pile', () => {
  const held = after(game(), { type: 'draw', from: 'deck' });
  const next = after(held, { type: 'discard' });
  for (const viewer of [1, 2] as Seat[]) {
    assert.deepEqual(slides(view(held, viewer), view(next, viewer)), [[HELD_KEY, DISCARD_KEY]]);
  }
});

test('a swap that calls Rack-O and ends the round slides like any swap', () => {
  const held = after(game(), { type: 'draw', from: 'discard' });
  const next = after(held, { type: 'place', slot: 4 });
  assert.ok(next.roundSummary);
  assert.deepEqual(slides(view(held, 2), view(next, 2)), [[HELD_KEY, slotKey(1, 4)], [slotKey(1, 4), DISCARD_KEY]]);
});

test('nothing slides without a last move', () => {
  assert.deepEqual(slides(view(game(), 1), view(game(), 1)), []);
});
