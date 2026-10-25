import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canRematch, lengthText, ordinal, winnerLine } from './gameOver.ts';
import type { BasePublicState } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';

const state = (winners: number[], moveCount = 1) => ({
  winners, moveCount, activePlayers: [1, 2, 3], playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' }
}) as unknown as BasePublicState;

test('winnerLine names one, two or three winners, and a draw', () => {
  assert.equal(winnerLine(state([1])), 'Alice wins');
  assert.equal(winnerLine(state([1, 2])), 'Alice and Bob win');
  assert.equal(winnerLine(state([1, 2, 3])), 'Alice, Bob and Cara win');
  assert.equal(winnerLine(state([])), 'Draw');
});

test('ordinal gives each place its suffix', () => {
  const places = [1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal);
  assert.deepEqual(places, ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
});

test("lengthText uses the game's own length, or counts moves", () => {
  assert.equal(lengthText(state([1]), {} as ClientGame), '1 move');
  assert.equal(lengthText(state([1], 5), {} as ClientGame), '5 moves');
  assert.equal(lengthText(state([1]), { gameLength: () => '3 rounds' } as unknown as ClientGame), '3 rounds');
});

test('canRematch is only for a seat at the table', () => {
  assert.equal(canRematch(state([1]), 2), true);
  assert.equal(canRematch(state([1]), null), false);
  assert.equal(canRematch(state([1]), 4), false);
});
