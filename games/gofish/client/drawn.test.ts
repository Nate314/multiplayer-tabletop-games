import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawnStep } from './drawn.ts';
import { cardKey } from './animateMove.ts';
import { createGameState, toPublicState } from '../rules.ts';
import { gofish } from '../index.ts';
import { applyMove } from '../../../shared/seating.ts';
import type { GameState, PlayingCard, PublicGameState, Rank, Result, Seat } from '../types.ts';

const c = (rank: Rank, suit: PlayingCard['suit'] = 'clubs'): PlayingCard => ({ rank, suit });

// Alice (seat 1) to ask; the top of the stock is the last card
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g'),
    started: true,
    currentPlayer: 1,
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    hands: {
      1: [c('7'), c('9'), c('K')],
      2: [c('7', 'hearts'), c('7', 'spades'), c('2')],
      3: [c('3'), c('4')]
    },
    stock: [c('5'), c('6'), c('Q')],
    books: { 1: [], 2: [], 3: [] },
    ...overrides
  };
}

function ask(state: GameState, seat: Seat, target: Seat, rank: Rank): GameState {
  const result: Result<GameState> = applyMove(gofish, state, seat, { type: 'ask', target, rank }, () => 0.5);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const view = (state: GameState, viewer: Seat, moveCount = 0): PublicGameState =>
  ({ ...toPublicState(state, false, viewer), moveCount });

test('a card fished from the stock is outlined until your next ask', () => {
  const before = game();
  const next = ask(before, 1, 3, 'K');
  assert.deepEqual(drawnStep(view(before, 1), view(next, 1), 1), { add: [cardKey(c('Q'))], clear: true });
  // Bob asks next; Alice's outline is untouched
  const bob = ask(next, 2, 1, '2');
  assert.deepEqual(drawnStep(view(next, 1), view(bob, 1), 1), { add: [], clear: false });
});

test('cards handed to you are not outlined', () => {
  const before = game();
  const next = ask(before, 1, 2, '7');
  assert.equal(next.hands[1].length, 5);
  assert.deepEqual(drawnStep(view(before, 1), view(next, 1), 1), { add: [], clear: true });
});

test('a fished card that completes a book is gone from your hand, so nothing is outlined', () => {
  const sevens = [c('7', 'clubs'), c('7', 'diamonds'), c('7', 'hearts')];
  const before = game({ hands: { 1: [...sevens, c('9')], 2: [c('2')], 3: [c('3'), c('4')] }, stock: [c('7', 'spades')] });
  const next = ask(before, 1, 2, '7');
  assert.deepEqual(next.books[1], ['7']);
  assert.deepEqual(drawnStep(view(before, 1), view(next, 1), 1), { add: [], clear: true });
});
