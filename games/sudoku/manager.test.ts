import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys, stepsOf } from '../../server/testing.ts';
import { seeded } from '../testStates.ts';
import { sudoku } from './index.ts';
import type { GameState, PublicGameState } from './types.ts';
import type { Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;
const ROOM = 'sudoku/g1';

function gameWith(...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([sudoku], seeded(3)));
  for (const name of names) manager.join('sudoku', 'g1', name);
  agreeAll(manager, ROOM);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Sudoku's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

// The full state, with the solution, which the public view hides
const raw = (manager: Manager): GameState => manager.rawState(ROOM) as GameState;
const openCells = (state: GameState): number[] => state.givens.flatMap((digit, cell) => (digit ? [] : [cell]));
const wrong = (state: GameState, cell: number): number => (state.solution[cell] % 9) + 1;
const enter = (cell: number, digit: number) => ({ type: 'enter', cell, digit });

test('two players entering at the same moment are both accepted', () => {
  const manager = gameWith('A', 'B');
  const state = raw(manager);
  const [a, b] = openCells(state);
  const before = manager.getState(ROOM)?.moveCount ?? 0;
  ok(manager.action(ROOM, 1, enter(a, wrong(state, a))));
  const after = ok(manager.action(ROOM, 2, enter(b, wrong(state, b))));
  assert.equal(after.moveCount, before + 2);
  assert.equal(after.board.by[a], 1);
  assert.equal(after.board.by[b], 2);
});

test('a note is not a move', () => {
  const manager = gameWith('A', 'B');
  const [a] = openCells(raw(manager));
  const before = manager.getState(ROOM)?.moveCount;
  const after = ok(manager.action(ROOM, 1, { type: 'note', cell: a, digit: 4 }));
  assert.equal(after.moveCount, before);
});

test('undoOwn is a step and leaves the friend\'s entry', () => {
  const manager = gameWith('A', 'B');
  const state = raw(manager);
  const [a, b] = openCells(state);
  ok(manager.action(ROOM, 1, enter(a, wrong(state, a))));
  ok(manager.action(ROOM, 2, enter(b, wrong(state, b))));
  const steps = stepsOf(manager, 'sudoku')?.length ?? 0;
  const undone = ok(manager.undoOwn(ROOM, 2));
  assert.equal(stepsOf(manager, 'sudoku')?.length, steps + 1);
  assert.equal(undone.board.entries[b], 0);
  assert.equal(undone.board.entries[a], wrong(state, a));
  assert.deepEqual(manager.requestUndo(ROOM, 1), { error: 'Use Undo my last move in this mode' });
});

test('Solo undo applies at once', () => {
  const manager = gameWith('A');
  const state = raw(manager);
  const [a] = openCells(state);
  assert.equal(ok(manager.move(ROOM, 1, enter(a, wrong(state, a)))).board.entries[a], wrong(state, a));
  const undone = ok(manager.requestUndo(ROOM, 1));
  assert.equal(undone.board.entries[a], 0);
  assert.equal(undone.undoVote, null);
});

test('the game continues when one of two Together players is dismissed', () => {
  const manager = gameWith('A', 'B');
  const state = raw(manager);
  const [first, ...rest] = openCells(state);
  ok(manager.action(ROOM, 2, enter(first, state.solution[first])));
  manager.disconnect(ROOM, 2);
  const left = ok(manager.requestDismiss(ROOM, 1, 2));
  assert.equal(left.isGameOver, false);
  assert.deepEqual(left.activePlayers, [1]);

  let last = left;
  for (const cell of rest) last = ok(manager.action(ROOM, 1, enter(cell, state.solution[cell])));
  assert.equal(last.isGameOver, true);
  assert.deepEqual(last.winners, [1]);
  assert.equal(last.gameStatus, 'Solved together!');
});
