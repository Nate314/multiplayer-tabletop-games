import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRules } from '../../server/testing.ts';
import type { PuzzleMode } from '../../shared/puzzleModes.ts';
import { addPlayer, applyMove } from '../../shared/seating.ts';
import { seeded } from '../testStates.ts';
import { sudoku } from './index.ts';
import type { GameState, PublicGameState, Seat } from './types.ts';

const NAMES = ['Alice', 'Bob', 'Cara'];
const EMPTY = [0, 40, 80];
const [A, B, C] = EMPTY;

// `count` seats in `mode`, with only `empty` cells open
function lobby(count: number, mode: PuzzleMode, empty = EMPTY): GameState {
  let state = sudoku.createGameState('g1');
  for (const name of NAMES.slice(0, count)) {
    const result = addPlayer(sudoku, state, name, seeded(1));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  state = sudoku.resetLobby({ ...state, houseRules: withRules({ mode, difficulty: 'medium' }) }, seeded(1));
  return { ...state, givens: state.solution.map((digit, cell) => (empty.includes(cell) ? 0 : digit)) };
}

const wrong = (state: GameState, cell: number): number => (state.solution[cell] % 9) + 1;
const enter = (cell: number, digit: number) => ({ type: 'enter', cell, digit });

function act(state: GameState, seat: Seat, action: unknown): GameState {
  const result = sudoku.applyAction!(state, seat, action, seeded(1), 0);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function move(state: GameState, seat: Seat, entry: unknown): GameState {
  const result = applyMove(sudoku, state, seat, entry);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

type View = Omit<PublicGameState, 'moveCount'>;
const viewOf = (state: GameState, viewer: Seat | null): View => sudoku.toPublicState(state, false, viewer);
const spectator = (state: GameState): View => sudoku.spectatorState!(state, false, false);
const tableScreen = (state: GameState): View => sudoku.spectatorState!(state, false, true);
const allViews = (state: GameState): View[] =>
  [...[null, ...state.activePlayers].map(viewer => viewOf(state, viewer)), spectator(state), tableScreen(state)];

// One mid-game state per mode, each with an entry, a note and (Solo) mistakes shown
function midGames(): GameState[] {
  const solo = lobby(1, 'solo');
  const together = lobby(2, 'together');
  const race = lobby(2, 'race');
  return [
    act(move(solo, 1, enter(A, solo.solution[A])), 1, { type: 'showMistakes', on: true }),
    act(act(together, 1, enter(A, together.solution[A])), 2, { type: 'note', cell: B, digit: 3 }),
    act(act(race, 1, enter(A, race.solution[A])), 2, enter(B, wrong(race, B)))
  ];
}

// Fills every open cell correctly for seat 1, so the game ends
function finished(state: GameState, solo: boolean): GameState {
  return EMPTY.reduce((s, cell) => (solo ? move(s, 1, enter(cell, s.solution[cell])) : act(s, 1, enter(cell, s.solution[cell]))), state);
}

test('no viewer sees the solution before the end', () => {
  for (const state of midGames()) {
    for (const view of allViews(state)) {
      assert.ok(!('solution' in view));
      assert.ok(!JSON.stringify(view).includes(JSON.stringify(state.solution)));
    }
  }
  const over = [finished(lobby(1, 'solo'), true), finished(lobby(2, 'together'), false), finished(lobby(2, 'race'), false)];
  for (const state of over) {
    assert.equal(state.isGameOver, true);
    for (const view of allViews(state)) assert.deepEqual(view.solution, state.solution);
  }
});

test('a Race seat sees only its own board, History sees none', () => {
  const state = midGames()[2];
  assert.deepEqual(viewOf(state, 1).raceBoards, { 1: state.raceBoards[1] });
  assert.deepEqual(viewOf(state, 2).raceBoards, { 2: state.raceBoards[2] });
  assert.deepEqual(viewOf(state, null).raceBoards, {});
});

test('everyone sees every board once the Race is over', () => {
  const state = finished(act(lobby(2, 'race'), 2, enter(B, wrong(lobby(2, 'race'), B))), false);
  assert.equal(state.isGameOver, true);
  for (const view of allViews(state)) assert.deepEqual(view.raceBoards, state.raceBoards);
});

test('a spectator sees every Race board, a table screen none', () => {
  const state = midGames()[2];
  assert.deepEqual(spectator(state).raceBoards, state.raceBoards);
  assert.deepEqual(tableScreen(state), viewOf(state, null));
});

test('progress is the share of non-given cells filled, wrong or not', () => {
  const open = Array.from({ length: 45 }, (_, i) => i);
  const state = lobby(2, 'race', open);
  const one = act(state, 1, enter(0, wrong(state, 0)));
  for (const view of allViews(one)) assert.deepEqual(view.progress, { 1: 2, 2: 0 });
  assert.deepEqual(viewOf(midGames()[1], null).progress, {});
});

test('a Race move shows others only who moved', () => {
  const state = act(lobby(2, 'race'), 1, enter(A, wrong(lobby(2, 'race'), A)));
  for (const view of [viewOf(state, 2), viewOf(state, null), tableScreen(state)]) {
    assert.deepEqual(view.lastMove, { type: 'enter', playerNumber: 1 });
  }
  assert.deepEqual(viewOf(state, 1).lastMove, state.lastMove);
  assert.deepEqual(spectator(state).lastMove, state.lastMove);
});

test('Together flags wrong entries to everyone', () => {
  const state = lobby(2, 'together');
  const marked = act(act(state, 1, enter(A, wrong(state, A))), 2, enter(B, state.solution[B]));
  for (const view of allViews(marked)) assert.deepEqual(view.wrong, [A]);
});

test('Race never flags wrong entries', () => {
  const state = midGames()[2];
  for (const view of allViews(state)) assert.ok(!('wrong' in view));
});

test('Solo shows mistakes only while the toggle is on', () => {
  const state = move(lobby(1, 'solo'), 1, enter(A, wrong(lobby(1, 'solo'), A)));
  assert.ok(!('wrong' in viewOf(state, 1)));
  assert.equal(viewOf(state, 1).showMistakes, false);
  const on = act(state, 1, { type: 'showMistakes', on: true });
  assert.deepEqual(viewOf(on, 1).wrong, [A]);
  assert.equal(viewOf(on, 1).showMistakes, true);
  assert.ok(!('showMistakes' in viewOf(lobby(2, 'together'), 1)));
});

test('pencil marks are shown only to their owner', () => {
  const state = act(lobby(2, 'together'), 1, { type: 'note', cell: A, digit: 5 });
  assert.deepEqual(viewOf(state, 1).myNotes, state.notes[1]);
  assert.deepEqual(viewOf(state, 2).myNotes, []);
  assert.equal(viewOf(state, null).myNotes, null);
  assert.equal(spectator(state).myNotes, null);
  assert.ok(!JSON.stringify(viewOf(state, 2)).includes(JSON.stringify(state.notes[1])));
});

test('boardWrong is true only for the owner of the full wrong board', () => {
  const state = lobby(3, 'race');
  const full = EMPTY.reduce((s, cell) => act(s, 1, enter(cell, cell === C ? wrong(s, C) : s.solution[cell])), state);
  assert.equal(full.isGameOver, false);
  assert.equal(viewOf(full, 1).boardWrong, true);
  for (const view of [viewOf(full, 2), viewOf(full, 3), viewOf(full, null), spectator(full)]) assert.equal(view.boardWrong, false);
});

test('ownUndo and undoAvailable follow the mode', () => {
  const together = act(lobby(2, 'together'), 1, enter(A, wrong(lobby(2, 'together'), A)));
  assert.equal(viewOf(together, 1).ownUndo, true);
  assert.equal(viewOf(together, 2).ownUndo, false);
  // A friend replaced the only entry, so undoOwn would skip it as stale
  const replaced = act(together, 2, enter(A, together.solution[A]));
  assert.equal(viewOf(replaced, 1).ownUndo, false);
  assert.equal(sudoku.toPublicState(together, true, 1).undoAvailable, false);
  const solo = move(lobby(1, 'solo'), 1, enter(A, wrong(lobby(1, 'solo'), A)));
  assert.equal(sudoku.toPublicState(solo, true, 1).undoAvailable, true);
  assert.equal(viewOf(solo, 1).ownUndo, false);
});

test('the table view plus privateSeatView is the seat\'s own view', () => {
  const state = act(midGames()[2], 1, { type: 'note', cell: B, digit: 2 });
  for (const seat of state.activePlayers) {
    const table = viewOf(state, null);
    assert.deepEqual({ ...table, ...(sudoku.privateSeatView!(state, seat) as object) }, viewOf(state, seat));
  }
});
