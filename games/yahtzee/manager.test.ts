import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { rememberingKeys } from '../../server/testing.ts';
import { yahtzee } from './index.ts';
import { allowedCategories } from './rules.ts';
import type { PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'yahtzee/g1';
const NONE = [false, false, false, false, false];

// Each value is one die face, read in order and then repeated
function dice(...faces: number[]): Random {
  let next = 0;
  return () => (faces[next++ % faces.length] - 0.5) / 6;
}

function gameWith(...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([yahtzee], dice(1, 2, 3, 4, 5, 6, 6, 6, 2, 3)));
  for (const name of names) manager.join('yahtzee', 'g1', name);
  return manager;
}

function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

test('a game of two plays all 13 rounds to a winner', () => {
  const manager = gameWith('Alice', 'Bob');
  let state = manager.getState(ROOM, null) as PublicGameState;
  for (let moves = 0; !state.isGameOver && moves < 200; moves++) {
    const seat = state.currentPlayer ?? assert.fail('nobody to play');
    state = state.dice.length === 0
      ? ok(manager.move(ROOM, seat, { type: 'roll', hold: NONE }))
      : ok(manager.move(ROOM, seat, { type: 'score', category: allowedCategories(state.dice, state.sheets[seat])[0] }));
  }
  assert.equal(state.isGameOver, true);
  assert.ok(state.winners.length >= 1);
  assert.equal(Object.keys(state.sheets[1]).length, 13);
  const file = manager.gameFile('yahtzee', 'g1', new Date(0));
  if (!file || 'error' in file) assert.fail('expected a game file');
});

test('a rejoin mid-turn shows the dice, the held flags and the rolls left', () => {
  const manager = gameWith('Alice', 'Bob');
  ok(manager.move(ROOM, 1, { type: 'roll', hold: NONE }));
  const rolled = ok(manager.move(ROOM, 1, { type: 'roll', hold: [true, true, false, false, false] }));
  manager.disconnect(ROOM, 1);
  const rejoined = manager.join('yahtzee', 'g1', 'Alice', true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  const view = rejoined.state as PublicGameState;
  assert.deepEqual(view.dice, rolled.dice);
  assert.deepEqual(view.held, [true, true, false, false, false]);
  assert.equal(view.rollsLeft, 1);
  assert.equal(view.currentPlayer, 1);
});

test('undo takes back a roll or a score', () => {
  const manager = gameWith('Alice', 'Bob');
  ok(manager.move(ROOM, 1, { type: 'roll', hold: NONE }));
  ok(manager.move(ROOM, 1, { type: 'score', category: 'chance' }));
  ok(manager.requestUndo(ROOM, 1));
  const restored = ok(manager.voteUndo(ROOM, 2, true));
  assert.equal(restored.currentPlayer, 1);
  assert.equal(restored.sheets[1].chance, undefined);
  assert.equal(restored.dice.length, 5);
  assert.equal(restored.rollsLeft, 2);
});

test('dismissing the player to move hands the turn on', () => {
  const manager = gameWith('Alice', 'Bob', 'Cara');
  ok(manager.move(ROOM, 1, { type: 'roll', hold: NONE }));
  manager.disconnect(ROOM, 1);
  ok(manager.requestDismiss(ROOM, 2, 1));
  const state = ok(manager.voteDismiss(ROOM, 3, true));
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.dice, []);
  assert.equal(state.rollsLeft, 3);
});
