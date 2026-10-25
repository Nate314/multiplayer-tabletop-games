import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawnStep } from './drawn.ts';
import { COLORS, createGameState, fullPool, toPublicState } from '../rules.ts';
import { rummikub } from '../index.ts';
import { applyMove } from '../../../shared/seating.ts';
import type { GameState, PublicGameState, Result, Seat, TileColor } from '../types.ts';

// The id of a numbered tile
const t = (color: TileColor, value: number): number => COLORS.indexOf(color) * 13 + value - 1;

// Alice (seat 1) to move with a first meld in hand; the pool is drawn from its start
function game(): GameState {
  const racks = { 1: [t('red', 10), t('red', 11), t('red', 12), t('blue', 1)], 2: [t('blue', 5), t('blue', 6)] };
  const used = new Set(Object.values(racks).flat());
  return {
    ...createGameState('g1'),
    started: true,
    currentPlayer: 1,
    activePlayers: [1, 2],
    playerNames: { 1: 'Alice', 2: 'Bob' },
    racks,
    table: [],
    pool: fullPool().filter(id => !used.has(id)),
    melded: []
  };
}

function after(state: GameState, seat: Seat, made: object): GameState {
  const result: Result<GameState> = applyMove(rummikub, state, seat, made, () => 0);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const view = (state: GameState, viewer: Seat, moveCount = 0): PublicGameState =>
  ({ ...toPublicState(state, false, viewer), moveCount });

test('a drawn tile is outlined until your next move', () => {
  const before = game();
  const next = after(before, 1, { type: 'draw' });
  const drawn = next.racks[1].filter(id => !before.racks[1].includes(id));
  assert.equal(drawn.length, 1);
  assert.deepEqual(drawnStep(view(before, 1), view(next, 1), 1), { add: drawn, clear: true });
  const bobs = after(next, 2, { type: 'draw' });
  assert.deepEqual(drawnStep(view(next, 1), view(bobs, 1), 1), { add: [], clear: false });
});

test('a play draws nothing', () => {
  const before = game();
  const next = after(before, 1, { type: 'play', table: [[t('red', 10), t('red', 11), t('red', 12)]] });
  assert.deepEqual(drawnStep(view(before, 1), view(next, 1), 1), { add: [], clear: true });
});

test("another player's draw changes nothing", () => {
  const before = { ...game(), currentPlayer: 2 };
  const next = after(before, 2, { type: 'draw' });
  assert.deepEqual(drawnStep(view(before, 1), view(next, 1), 1), { add: [], clear: false });
});
