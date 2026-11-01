import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markOf, withFirstMark, xSeatFor } from './marks.ts';
import { baseGameState } from '../../shared/seating.ts';
import type { BaseGameState } from '../../shared/types.ts';

function game(gameNumber: number | undefined, activePlayers: number[]): BaseGameState & { xSeat: number; gameNumber?: number } {
  return { ...baseGameState('g1'), gameNumber, activePlayers, xSeat: 1 };
}

test('seat 1 plays X in game 1 and when gameNumber is missing', () => {
  assert.equal(xSeatFor(1), 1);
  assert.equal(xSeatFor(undefined), 1);
});

test('seat 2 plays X in even games', () => {
  assert.equal(xSeatFor(2), 2);
  assert.equal(xSeatFor(3), 1);
});

test('withFirstMark gives the turn to the X seat once it is seated', () => {
  const alone = withFirstMark({ ...game(2, [1]), currentPlayer: 1 });
  assert.equal(alone.xSeat, 2);
  assert.equal(alone.currentPlayer, 1);

  const both = withFirstMark({ ...game(2, [1, 2]), currentPlayer: 1 });
  assert.equal(both.xSeat, 2);
  assert.equal(both.currentPlayer, 2);
});

test('markOf', () => {
  assert.equal(markOf({ xSeat: 1 }, 1), 'X');
  assert.equal(markOf({ xSeat: 1 }, 2), 'O');
  assert.equal(markOf({ xSeat: 2 }, 1), 'O');
  assert.equal(markOf({ xSeat: 2 }, 2), 'X');
});
