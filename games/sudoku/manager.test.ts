import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, fileOf, rememberingKeys, stepsOf } from '../../server/testing.ts';
import { seeded } from '../testStates.ts';
import { sudoku } from './index.ts';
import type { GameState, PublicGameState } from './types.ts';
import type { HouseRuleValues } from '../../shared/houseRules.ts';
import type { Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;
const ROOM = 'sudoku/g1';

// A started table; `values` are house rules the host sets before everyone agrees
function tableWith(names: string[], values?: HouseRuleValues): Manager {
  const manager = rememberingKeys(createGameManager([sudoku], seeded(3)));
  for (const name of names) manager.join('sudoku', 'g1', name);
  if (values) ok(manager.setHouseRules(ROOM, 1, { values, maxPlayers: null }));
  agreeAll(manager, ROOM);
  return manager;
}
const gameWith = (...names: string[]): Manager => tableWith(names);

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

// The platform offers the game file only once the game is over; its table steps before the end still hide both
test('History and the game file never hold the solution mid-game', () => {
  const manager = tableWith(['A', 'B'], { mode: 'race' });
  const state = raw(manager);
  const [a, b, c, ...rest] = openCells(state);
  ok(manager.action(ROOM, 1, enter(a, state.solution[a])));
  ok(manager.action(ROOM, 2, enter(b, wrong(state, b))));
  ok(manager.action(ROOM, 2, enter(c, state.solution[c])));
  const secrets = [JSON.stringify(state.solution), JSON.stringify(raw(manager).raceBoards[2]?.entries)];
  const hidesSecrets = (shown: string) => secrets.every(secret => !shown.includes(secret));

  const steps = stepsOf(manager, 'sudoku');
  assert.equal(steps?.length, 4);
  assert.ok(hidesSecrets(JSON.stringify(steps)));
  assert.deepEqual(fileOf(manager, 'sudoku', new Date(0)), { error: 'The game is not over yet' });

  for (const cell of [b, c, ...rest]) ok(manager.action(ROOM, 1, enter(cell, state.solution[cell])));
  assert.equal(raw(manager).isGameOver, true);
  const file = fileOf(manager, 'sudoku', new Date(0));
  if (!('file' in file)) assert.fail(file.error);
  const tableSteps = file.file.steps.slice(0, -1).map(step => ({ ...step, views: undefined }));
  assert.ok(hidesSecrets(JSON.stringify(tableSteps)));
});

test('Together has no turn: a seat disconnects and is dismissed while play goes on', () => {
  const manager = gameWith('A', 'B', 'C');
  const state = raw(manager);
  const [a, b, c] = openCells(state);
  assert.equal(manager.getState(ROOM)?.currentPlayer, null);
  ok(manager.action(ROOM, 1, enter(a, state.solution[a])));
  manager.disconnect(ROOM, 1);
  const during = ok(manager.action(ROOM, 2, enter(b, state.solution[b])));
  assert.equal(during.currentPlayer, null);
  assert.equal(during.isGameOver, false);
  ok(manager.requestDismiss(ROOM, 2, 1));
  const after = ok(manager.voteDismiss(ROOM, 3, true));
  assert.deepEqual(after.activePlayers, [2, 3]);
  const later = ok(manager.action(ROOM, 3, enter(c, state.solution[c])));
  assert.equal(later.currentPlayer, null);
  assert.equal(later.isGameOver, false);
});

test('re-entering the same digit is not a move', () => {
  const manager = gameWith('A', 'B');
  const state = raw(manager);
  const [a] = openCells(state);
  const before = ok(manager.action(ROOM, 1, enter(a, state.solution[a]))).moveCount;
  assert.equal(ok(manager.action(ROOM, 2, enter(a, state.solution[a]))).moveCount, before);
});
