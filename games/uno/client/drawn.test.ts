import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawnStep, markDrawn } from './drawn.ts';
import { createGameState, toPublicState } from '../rules.ts';
import { uno } from '../index.ts';
import { applyMove } from '../../../shared/seating.ts';
import type { Card, Color, GameState, PublicGameState, Result, Seat, Value } from '../types.ts';

const card = (color: Color, value: Value): Card => ({ color, value });
const red = (value: Value) => card('red', value);
const blue = (value: Value) => card('blue', value);

// Alice (seat 1) to move on a red 5; the draw pile is drawn from its end
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g'),
    started: true,
    currentPlayer: 1,
    turnHolder: 1,
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    dealer: 3,
    scores: { 1: 0, 2: 0, 3: 0 },
    hands: { 1: [red('7'), blue('5'), blue('9')], 2: [blue('1'), blue('2'), red('drawTwo')], 3: [blue('3'), blue('4')] },
    drawPile: [blue('6'), blue('7'), blue('8'), red('8')],
    discardPile: [red('5')],
    currentColor: 'red',
    ...overrides
  };
}

function after(state: GameState, seat: Seat, made: object): GameState {
  const result: Result<GameState> = applyMove(uno, state, seat, made, () => 0.5);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const view = (state: GameState, viewer: Seat, moveCount = 0): PublicGameState =>
  ({ ...toPublicState(state, false, viewer), moveCount });

test('your draw outlines the card you drew', () => {
  const before = game();
  const next = after(before, 1, { type: 'draw' });
  assert.deepEqual(drawnStep(view(before, 1), view(next, 1), 1), { add: [red('8')], clear: true });
});

test('cards a Draw Two makes you take stay outlined until your next move', () => {
  const before = game({ currentPlayer: 2, turnHolder: 2 });
  const next = after(before, 2, { type: 'play', card: red('drawTwo') });
  assert.deepEqual(drawnStep(view(before, 3), view(next, 3), 3), { add: [red('8'), blue('8')], clear: false });
  assert.deepEqual(drawnStep(view(before, 2), view(next, 2), 2), { add: [], clear: true });
});

test('your next play clears them', () => {
  const before = after(game(), 1, { type: 'draw' });
  const next = after(before, 1, { type: 'play', card: red('8') });
  assert.deepEqual(drawnStep(view(before, 1), view(next, 1), 1), { add: [], clear: true });
});

test('two copies of one card mark only as many as were drawn', () => {
  const hand = [red('7'), red('7'), blue('5')];
  assert.deepEqual(markDrawn(hand, [red('7')]), [true, false, false]);
  assert.deepEqual(markDrawn(hand, [red('7'), red('7')]), [true, true, false]);
  assert.deepEqual(markDrawn(hand, [blue('5'), red('9')]), [false, false, true]);
});

test('a drawn copy of a card you already held adds one card, not two', () => {
  const before = game({ hands: { ...game().hands, 1: [red('8'), blue('5')] } });
  const next = after(before, 1, { type: 'draw' });
  assert.deepEqual(drawnStep(view(before, 1), view(next, 1), 1), { add: [red('8')], clear: true });
});
