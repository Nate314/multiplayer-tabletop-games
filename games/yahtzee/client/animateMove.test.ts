import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DICE_KEY, cellKey, scoreSlide, tumbling } from './animateMove.ts';
import { createGameState, toPublicState } from '../rules.ts';
import { yahtzee } from '../index.ts';
import { addPlayer, applyMove } from '../../../shared/seating.ts';
import type { Random } from '../../../shared/types.ts';
import type { GameState, PublicGameState } from '../types.ts';

// Each value is one die face, read in order and then repeated
function dice(...faces: number[]): Random {
  let next = 0;
  return () => (faces[next++ % faces.length] - 0.5) / 6;
}

const NONE = [false, false, false, false, false];

function lobby(): GameState {
  let state = createGameState('g');
  for (const name of ['Alice', 'Bob']) {
    const result = addPlayer(yahtzee, state, name, dice(1));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

function after(state: GameState, move: unknown, random: Random = dice(1, 2, 3, 4, 5)): GameState {
  const result = applyMove(yahtzee, state, state.currentPlayer ?? 1, move, random);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// What a browser holds, with the move count the animation hook counts
const view = (state: GameState): PublicGameState => ({ ...toPublicState(state, false), moveCount: 0 });

const start = { ...lobby(), started: true };
const roll = { type: 'roll', hold: NONE };
const rolled = after(start, roll);

test('the first roll of a turn tumbles all five dice', () => {
  assert.deepEqual(tumbling(view(after(start, roll))), [0, 1, 2, 3, 4]);
});

test('a reroll tumbles only the dice not held', () => {
  const next = after(rolled, { type: 'roll', hold: [true, false, true, false, false] });
  assert.deepEqual(tumbling(view(next)), [1, 3, 4]);
});

test('scoring tumbles nothing and slides the points from the dice to their box', () => {
  const next = view(after(rolled, { type: 'score', category: 'chance' }));
  assert.deepEqual(tumbling(next), []);
  assert.deepEqual(scoreSlide(next), [DICE_KEY, cellKey(1, 'chance')]);
});

test('scoring the last box of the game still slides the points', () => {
  const full = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6, threeKind: 0, fourKind: 0, fullHouse: 0, smallStraight: 30, largeStraight: 40, yahtzee: 0 };
  const nearly: GameState = { ...rolled, sheets: { 1: full, 2: { ...full, chance: 10 } } };
  const next = after(nearly, { type: 'score', category: 'chance' });
  assert.ok(next.isGameOver);
  assert.equal(next.dice.length, 0);
  assert.deepEqual(scoreSlide(view(next)), [DICE_KEY, cellKey(1, 'chance')]);
});

test('a roll slides nothing, and nothing happens without a last move', () => {
  assert.equal(scoreSlide(view(rolled)), null);
  assert.equal(scoreSlide(view(start)), null);
  assert.deepEqual(tumbling(view(start)), []);
});
