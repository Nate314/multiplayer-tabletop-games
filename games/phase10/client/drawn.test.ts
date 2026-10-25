import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawnStep } from './drawn.ts';
import { createGameState, toPublicState } from '../rules.ts';
import { phase10 } from '../index.ts';
import { applyMove as applySeatedMove } from '../../../shared/seating.ts';
import type { Card, CardColor, GameState, PublicGameState, Result, Seat } from '../types.ts';

let nextId = 1;
const num = (value: number, color: CardColor = 'red'): Card => ({ id: nextId++, kind: 'number', value, color });

// Alice (seat 1) to move, Bob and Cara seated; the draw pile is drawn from its end
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g1'),
    started: true,
    currentPlayer: 1,
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    dealer: 3,
    hands: { 1: [num(1), num(2)], 2: [num(3), num(4)], 3: [num(5), num(6)] },
    drawPile: [num(7), num(8, 'blue')],
    discardPile: [num(9, 'green')],
    phases: { 1: 1, 2: 1, 3: 1 },
    scores: { 1: 0, 2: 0, 3: 0 },
    ...overrides
  };
}

function after(state: GameState, input: unknown, seat: Seat = state.currentPlayer ?? 1): GameState {
  const result: Result<GameState> = applySeatedMove(phase10, state, seat, input, () => 0.5);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const view = (state: GameState, viewer: Seat | null, moveCount = 0): PublicGameState =>
  ({ ...toPublicState(state, false, viewer), moveCount });

const drawn = (state: GameState) => after(state, { type: 'draw', source: 'pile' });

test('your draw highlights the drawn card and starts fresh', () => {
  const before = game();
  const id = before.drawPile[1].id;
  assert.deepEqual(drawnStep(view(before, 1), view(drawn(before), 1), 1), { add: [id], clear: true });
});

test('laying down and hitting keep the highlight', () => {
  const sevens = [num(7), num(7, 'blue'), num(7, 'green')];
  const nines = [num(9), num(9, 'blue'), num(9, 'green')];
  const before = drawn(game({ hands: { 1: [...sevens, ...nines, num(1)], 2: [num(3)], 3: [num(5)] } }));
  const laid = after(before, { type: 'layDown', groups: [sevens.map(c => c.id), nines.map(c => c.id)] });
  assert.deepEqual(drawnStep(view(before, 1), view(laid, 1), 1), { add: [], clear: false });
  const extra = num(7, 'yellow');
  laid.hands[1].push(extra);
  const hit = after(laid, { type: 'hit', group: 0, cards: [extra.id] });
  assert.deepEqual(drawnStep(view(laid, 1), view(hit, 1), 1), { add: [], clear: false });
});

test('your discard clears it', () => {
  const before = drawn(game());
  const next = after(before, { type: 'discard', card: before.hands[1][0].id, skip: null });
  assert.deepEqual(drawnStep(view(before, 1), view(next, 1), 1), { add: [], clear: true });
});

test("another player's moves change nothing", () => {
  const before = game();
  assert.deepEqual(drawnStep(view(before, 2), view(drawn(before), 2), 2), { add: [], clear: false });
  const held = drawn(before);
  const next = after(held, { type: 'discard', card: held.hands[1][0].id, skip: null });
  assert.deepEqual(drawnStep(view(held, 2), view(next, 2), 2), { add: [], clear: false });
});
