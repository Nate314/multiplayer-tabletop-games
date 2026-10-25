import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISCARD_KEY, PILE_KEY, cardKey, plan } from './animateMove.ts';
import { seatKey } from '../../../src/animation/animKeys.ts';
import { createGameState, toPublicState } from '../rules.ts';
import { phase10 } from '../index.ts';
import { applyMove as applySeatedMove } from '../../../shared/seating.ts';
import type { Card, CardColor, GameState, PublicGameState, Result, Seat } from '../types.ts';

let nextId = 1;
const num = (value: number, color: CardColor = 'red'): Card => ({ id: nextId++, kind: 'number', value, color });
const wild = (): Card => ({ id: nextId++, kind: 'wild' });
const skip = (): Card => ({ id: nextId++, kind: 'skip' });

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

// What one player's browser holds, with the move count the animation hook counts
const view = (state: GameState, viewer: Seat | null, moveCount = 0): PublicGameState =>
  ({ ...toPublicState(state, false, viewer), moveCount });

const drawn = (state: GameState) => after(state, { type: 'draw', source: 'pile' });
const NOTHING = { slides: [], ghosts: [], flash: null };

test('your draw from the pile slides the new card from the pile into your hand', () => {
  const before = game();
  const id = before.drawPile[1].id;
  assert.deepEqual(plan(view(before, 1), view(drawn(before), 1)),
    { slides: [[PILE_KEY, cardKey(id)]], ghosts: [], flash: null });
});

test('your draw from the discard pile slides it from the discard pile', () => {
  const before = game();
  const id = before.discardPile[0].id;
  assert.deepEqual(plan(view(before, 1), view(after(before, { type: 'draw', source: 'discard' }), 1)),
    { slides: [[DISCARD_KEY, cardKey(id)]], ghosts: [], flash: null });
});

test("another player's draw sends a card back from the pile to their seat", () => {
  const before = game();
  assert.deepEqual(plan(view(before, 2), view(drawn(before), 2)),
    { slides: [], ghosts: [{ card: null, from: PILE_KEY, to: seatKey(1) }], flash: null });
});

test("another player's take from the discard pile sends that card to their seat", () => {
  const before = game();
  const top = before.discardPile[0];
  assert.deepEqual(plan(view(before, 2), view(after(before, { type: 'draw', source: 'discard' }), 2)),
    { slides: [], ghosts: [{ card: top, from: DISCARD_KEY, to: seatKey(1) }], flash: null });
});

test('a discard slides to the discard pile from your hand, or from the seat of whoever discarded', () => {
  const before = drawn(game());
  const id = before.hands[1][0].id;
  const next = after(before, { type: 'discard', card: id, skip: null });
  assert.deepEqual(plan(view(before, 1), view(next, 1)), { slides: [[cardKey(id), DISCARD_KEY]], ghosts: [], flash: null });
  assert.deepEqual(plan(view(before, 2), view(next, 2)), { slides: [[seatKey(1), DISCARD_KEY]], ghosts: [], flash: null });
});

test('laying down a phase slides each card of the new groups from the hand to the table', () => {
  const sevens = [num(7), num(7, 'blue'), wild()];
  const nines = [num(9), num(9, 'blue'), num(9, 'green')];
  const before = drawn(game({ hands: { 1: [...sevens, ...nines, num(1)], 2: [num(3)], 3: [num(5)] } }));
  const next = after(before, { type: 'layDown', groups: [sevens.map(c => c.id), nines.map(c => c.id)] });
  const laid = [...sevens, ...nines].map(card => card.id);
  assert.deepEqual(plan(view(before, 1), view(next, 1)).slides, laid.map(id => [cardKey(id), cardKey(id)]));
  assert.deepEqual(plan(view(before, 2), view(next, 2)).slides, laid.map(id => [seatKey(1), cardKey(id)]));
});

test('a hit slides only the added cards onto the group', () => {
  const group = { owner: 1, kind: 'set' as const, value: 7, cards: [num(7), num(7, 'blue'), num(7, 'green')] };
  const extra = [num(7, 'yellow'), wild()];
  const before = drawn(game({ groups: [group], phases: { 1: 2, 2: 1, 3: 1 }, hands: { 1: [...extra, num(1)], 2: [num(3)], 3: [num(5)] } }));
  const next = after(before, { type: 'hit', group: 0, cards: extra.map(c => c.id) });
  assert.deepEqual(plan(view(before, 1), view(next, 1)).slides, extra.map(c => [cardKey(c.id), cardKey(c.id)]));
  assert.deepEqual(plan(view(before, 3), view(next, 3)).slides, extra.map(c => [seatKey(1), cardKey(c.id)]));
});

test('a Skip slides to the discard pile and the skipped seat flashes', () => {
  const card = skip();
  const before = drawn(game({ hands: { 1: [card, num(1)], 2: [num(3)], 3: [num(5)] } }));
  const next = after(before, { type: 'discard', card: card.id, skip: 3 });
  assert.deepEqual(plan(view(before, 1), view(next, 1)),
    { slides: [[cardKey(card.id), DISCARD_KEY]], ghosts: [], flash: seatKey(3) });
});

test('a discard that ends the hand still slides to the discard pile', () => {
  const before = drawn(game({ hands: { 1: [], 2: [num(3)], 3: [num(5)] } }));
  const id = before.hands[1][0].id;
  const next = after(before, { type: 'discard', card: id, skip: null });
  assert.ok(next.handSummary);
  assert.deepEqual(plan(view(before, 1), view(next, 1)), { slides: [[cardKey(id), DISCARD_KEY]], ghosts: [], flash: null });
});

test('nothing moves without a last move', () => {
  assert.deepEqual(plan(view(game(), 1), view(game(), 1)), NOTHING);
});
