import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRules } from '../../server/testing.ts';
import { MODE_RULE, modeOf, type PuzzleMode } from '../../shared/puzzleModes.ts';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import { seeded } from '../testStates.ts';
import { sudoku } from './index.ts';
import type { Difficulty } from './options.ts';
import type { Board, GameState, Seat } from './types.ts';

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan'];
const EMPTY = [0, 40, 80]; // the only cells left open, so a test reaches the end in three entries
const GIVEN = 1;

function seatAll(count: number): GameState {
  let state = sudoku.createGameState('g1');
  for (const name of NAMES.slice(0, count)) {
    const result = addPlayer(sudoku, state, name, seeded(1));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

// `count` seats in `mode`, with only `empty` cells open
function lobby(count: number, mode: PuzzleMode, empty = EMPTY, difficulty: Difficulty = 'medium'): GameState {
  const seatedState = seatAll(count);
  const state = sudoku.resetLobby({ ...seatedState, houseRules: withRules({ mode, difficulty }) }, seeded(1));
  return { ...state, givens: state.solution.map((digit, cell) => (empty.includes(cell) ? 0 : digit)) };
}

const wrong = (state: GameState, cell: number): number => (state.solution[cell] % 9) + 1;
const enter = (cell: number, digit: number) => ({ type: 'enter', cell, digit });
const erase = (cell: number) => ({ type: 'erase', cell });
const note = (cell: number, digit: number) => ({ type: 'note', cell, digit });

function act(state: GameState, seat: Seat, action: unknown): GameState {
  const result = sudoku.applyAction!(state, seat, action, seeded(1), 0);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function refusal(state: GameState, seat: Seat, action: unknown): string | undefined {
  const result = sudoku.applyAction!(state, seat, action, seeded(1), 0);
  return 'error' in result ? result.error : undefined;
}

function move(state: GameState, seat: Seat, entry: unknown): GameState {
  const result = applyMove(sudoku, state, seat, entry);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function undo(state: GameState, seat: Seat): GameState {
  const result = sudoku.undoOwn!(state, seat);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const emptyBoard = (board: Board | undefined): boolean => !!board && board.entries.every(digit => digit === 0) && board.by.every(seat => seat === null);

test('the mode follows the seat count', () => {
  const solo = seatAll(1);
  assert.equal(modeOf(solo, MODE_RULE), 'solo');
  assert.equal(solo.gameStatus, 'Solve the puzzle');
  const together = seatAll(2);
  assert.equal(modeOf(together, MODE_RULE), 'together');
  assert.equal(together.gameStatus, 'Everyone plays at once on one board');
});

test('resetLobby keeps the puzzle until the difficulty changes', () => {
  const one = seatAll(1);
  assert.equal(one.givens.length, 81);
  assert.equal(one.solution.length, 81);
  const two = seatAll(2);
  assert.deepEqual(two.givens, one.givens);
  const hard = sudoku.resetLobby({ ...two, houseRules: withRules({ mode: 'together', difficulty: 'hard' }) }, seeded(2));
  assert.equal(hard.difficulty, 'hard');
  assert.notDeepEqual(hard.givens, two.givens);
});

test('Race gives every seat the same empty board', () => {
  const state = lobby(3, 'race');
  assert.deepEqual(Object.keys(state.raceBoards), ['1', '2', '3']);
  for (const seat of [1, 2, 3]) assert.ok(emptyBoard(state.raceBoards[seat]));
  assert.equal(state.gameStatus, 'Race: everyone has the same puzzle; first to finish wins');
});

test('Solo entries are moves and Together entries are actions', () => {
  const solo = lobby(1, 'solo');
  assert.equal(move(solo, 1, enter(0, 5)).board.entries[0], 5);
  assert.equal(refusal(solo, 1, enter(0, 5)), 'Wrong kind of entry for this mode');
  assert.equal(refusal(solo, 1, erase(0)), 'Wrong kind of entry for this mode');

  const together = lobby(2, 'together');
  assert.equal(act(together, 2, enter(0, 5)).board.entries[0], 5);
  // Nobody holds the turn, so the platform refuses a move before the game sees it
  assert.deepEqual(applyMove(sudoku, together, 1, enter(0, 5)), { error: 'Not your turn' });
  assert.deepEqual(sudoku.applyMove(together, 1, enter(0, 5), seeded(1), 0), { error: 'Wrong kind of entry for this mode' });
  const race = lobby(2, 'race');
  assert.deepEqual(sudoku.applyMove(race, 1, erase(0), seeded(1), 0), { error: 'Wrong kind of entry for this mode' });
});

test('bad cells, digits and types are refused', () => {
  const state = lobby(2, 'together');
  for (const cell of [81, -1, 1.5, '3']) {
    assert.equal(refusal(state, 1, { type: 'enter', cell, digit: 5 }), 'Pick a square', String(cell));
    assert.equal(refusal(state, 1, { type: 'erase', cell }), 'Pick a square', String(cell));
    assert.equal(refusal(state, 1, { type: 'note', cell, digit: 5 }), 'Pick a square', String(cell));
  }
  for (const digit of [0, 10, '5']) {
    assert.equal(refusal(state, 1, { type: 'enter', cell: 0, digit }), 'Pick a digit from 1 to 9', String(digit));
    assert.equal(refusal(state, 1, { type: 'note', cell: 0, digit }), 'Pick a digit from 1 to 9', String(digit));
  }
  assert.equal(refusal(state, 1, { type: 'jump' }), 'Invalid move');
  assert.equal(refusal(state, 1, null), 'Invalid move');
  const over = { ...state, isGameOver: true };
  for (const action of [enter(0, 5), erase(0), note(0, 5), { type: 'showMistakes', on: true }]) {
    assert.equal(refusal(over, 1, action), 'The game is over');
  }
  assert.deepEqual(sudoku.undoOwn!(over, 1), { error: 'The game is over' });
});

test('a given cannot be changed', () => {
  const state = lobby(2, 'together');
  assert.equal(refusal(state, 1, enter(GIVEN, 5)), 'That square is a given');
  assert.equal(refusal(state, 1, erase(GIVEN)), 'That square is a given');
  assert.equal(refusal(state, 1, note(GIVEN, 5)), 'That square is a given');
  const solo = lobby(1, 'solo');
  assert.deepEqual(applyMove(sudoku, solo, 1, enter(GIVEN, 5)), { error: 'That square is a given' });
});

test('Together: a correct entry is locked and a wrong one can be replaced by anyone', () => {
  let state = lobby(2, 'together');
  state = act(state, 1, enter(0, state.solution[0]));
  assert.equal(refusal(state, 2, enter(0, wrong(state, 0))), 'That square is already correct');
  assert.equal(refusal(state, 1, enter(0, wrong(state, 0))), 'That square is already correct');

  state = act(state, 1, enter(40, wrong(state, 40)));
  state = act(state, 2, enter(40, (wrong(state, 40) % 9) + 1));
  assert.equal(state.board.entries[40], (wrong(state, 40) % 9) + 1);
  assert.equal(state.board.by[40], 2);
});

test('Together: a correct entry is locked against erasing, even by its owner', () => {
  let state = lobby(2, 'together');
  state = act(state, 1, enter(0, state.solution[0]));
  assert.equal(refusal(state, 2, erase(0)), 'A correct entry is locked');
  assert.equal(refusal(state, 1, erase(0)), 'A correct entry is locked');
  assert.equal(refusal(state, 1, erase(40)), 'That square is empty');

  state = act(state, 1, enter(40, wrong(state, 40)));
  const erased = act(state, 2, erase(40));
  assert.equal(erased.board.entries[40], 0);
  assert.equal(erased.board.by[40], null);
  assert.deepEqual(erased.lastMove, { type: 'erase', playerNumber: 2, cell: 40 });
  assert.equal(act(state, 1, erase(40)).board.entries[40], 0);
});

test('notes are per seat and toggled', () => {
  let state = lobby(2, 'together');
  state = act(state, 1, note(0, 3));
  assert.equal(state.notes[1]?.[0], 1 << 3);
  assert.equal(state.notes[2], undefined);
  assert.equal(act(state, 1, note(0, 3)).notes[1]?.[0], 0);

  state = act(state, 2, note(0, 4));
  state = act(state, 1, enter(0, wrong(state, 0)));
  assert.equal(state.notes[1]?.[0], 0);
  assert.equal(state.notes[2]?.[0], 1 << 4);
});

test('showMistakes is Solo only', () => {
  const solo = lobby(1, 'solo');
  assert.equal(act(solo, 1, { type: 'showMistakes', on: true }).showMistakes, true);
  assert.equal(refusal(solo, 1, { type: 'showMistakes', on: 'yes' }), 'Invalid move');
  assert.equal(refusal(lobby(2, 'together'), 1, { type: 'showMistakes', on: true }), 'Mistakes are shown only in Solo');
});

test('every action starts the game', () => {
  const state = lobby(2, 'together');
  for (const action of [enter(0, 5), note(0, 5)]) assert.equal(act(state, 1, action).started, true);
  assert.equal(act(lobby(1, 'solo'), 1, { type: 'showMistakes', on: true }).started, true);
});

test('recordsAction is true only for Together and Race entries', () => {
  const together = lobby(2, 'together');
  assert.equal(sudoku.recordsAction!(together, 1, enter(0, 5)), true);
  assert.equal(sudoku.recordsAction!(together, 1, erase(0)), true);
  assert.equal(sudoku.recordsAction!(together, 1, note(0, 5)), false);
  assert.equal(sudoku.recordsAction!(lobby(2, 'race'), 1, enter(0, 5)), true);
  assert.equal(sudoku.recordsAction!(lobby(1, 'solo'), 1, enter(0, 5)), false);
});

test('undoOwn takes back only the requester\'s last move', () => {
  let state = lobby(2, 'together');
  state = act(state, 1, enter(0, wrong(state, 0)));
  state = act(state, 2, enter(40, wrong(state, 40)));
  const undone = undo(state, 1);
  assert.equal(undone.board.entries[0], 0);
  assert.equal(undone.board.by[0], null);
  assert.equal(undone.board.entries[40], wrong(state, 40));
  assert.deepEqual(undone.lastMove, { type: 'undoOwn', playerNumber: 1, cell: 0 });
});

test('undoOwn restores an erased friend\'s entry', () => {
  let state = lobby(2, 'together');
  state = act(state, 1, enter(0, wrong(state, 0)));
  state = act(state, 2, erase(0));
  const undone = undo(state, 2);
  assert.equal(undone.board.entries[0], wrong(state, 0));
  assert.equal(undone.board.by[0], 1);
});

test('undoOwn skips a move a friend has since replaced', () => {
  let state = lobby(2, 'together');
  state = act(state, 1, enter(0, wrong(state, 0)));
  state = act(state, 1, enter(40, wrong(state, 40)));
  const friends = (wrong(state, 40) % 9) + 1;
  state = act(state, 2, enter(40, friends));
  const undone = undo(state, 1);
  assert.equal(undone.board.entries[0], 0);
  assert.equal(undone.board.entries[40], friends);
  assert.equal(undone.board.by[40], 2);
  assert.deepEqual(sudoku.undoOwn!(undone, 1), { error: 'Nothing of yours to undo' });
});

test('undoOwn in Race touches only the requester\'s board', () => {
  let state = lobby(2, 'race');
  state = act(state, 1, enter(0, 5));
  state = act(state, 2, enter(0, 6));
  const undone = undo(state, 1);
  assert.equal(undone.raceBoards[1]?.entries[0], 0);
  assert.equal(undone.raceBoards[2]?.entries[0], 6);
  assert.equal(undone.raceBoards[2]?.by[0], 2);
});

test('undoOwn with nothing left is refused', () => {
  assert.deepEqual(sudoku.undoOwn!(lobby(2, 'together'), 1), { error: 'Nothing of yours to undo' });
});

test('undoOwn in Solo is refused', () => {
  const state = move(lobby(1, 'solo'), 1, enter(0, 5));
  assert.deepEqual(sudoku.undoOwn!(state, 1), { error: 'Solo uses Undo' });
});

test('filling the last square correctly ends Solo and Together with everyone winning', () => {
  let solo = lobby(1, 'solo');
  for (const cell of EMPTY) solo = move(solo, 1, enter(cell, solo.solution[cell]));
  assert.equal(solo.isGameOver, true);
  assert.equal(solo.currentPlayer, null);
  assert.deepEqual(solo.winners, [1]);
  assert.equal(solo.gameStatus, 'Solved!');

  let together = lobby(2, 'together');
  together = act(together, 1, enter(0, together.solution[0]));
  together = act(together, 2, enter(40, wrong(together, 40)));
  assert.equal(together.isGameOver, false);
  together = act(together, 1, enter(40, together.solution[40]));
  together = act(together, 2, enter(80, together.solution[80]));
  assert.equal(together.isGameOver, true);
  assert.equal(together.currentPlayer, null);
  assert.deepEqual(together.winners, [1, 2]);
  assert.equal(together.gameStatus, 'Solved together!');
});

test('a full wrong Race board tells only its owner', () => {
  let state = lobby(2, 'race');
  state = act(state, 1, enter(0, state.solution[0]));
  state = act(state, 1, enter(40, state.solution[40]));
  state = act(state, 1, enter(80, wrong(state, 80)));
  assert.equal(state.isGameOver, false);
  assert.deepEqual(state.raceWrong, { 1: true });
  assert.deepEqual(act(state, 1, erase(80)).raceWrong, {});
  assert.deepEqual(undo(state, 1).raceWrong, {});
});

test('the first correct Race board wins', () => {
  let state = lobby(3, 'race');
  state = act(state, 1, enter(0, state.solution[0]));
  for (const cell of EMPTY) state = act(state, 2, enter(cell, state.solution[cell]));
  assert.equal(state.isGameOver, true);
  assert.equal(state.currentPlayer, null);
  assert.deepEqual(state.winners, [2]);
  assert.equal(state.gameStatus, 'Bob finished first!');
  assert.deepEqual(state.lastMove, { type: 'enter', playerNumber: 2, cell: 80, digit: state.solution[80], finished: true });
});

test('a player leaving Race loses their board and the game goes on', () => {
  let state = lobby(3, 'race');
  state = act(state, 2, enter(0, 5));
  state = act(state, 2, note(40, 5));
  const left = removePlayer(sudoku, state, 2);
  assert.deepEqual(Object.keys(left.raceBoards), ['1', '3']);
  assert.equal(left.notes[2], undefined);
  assert.equal(left.ownMoves[2], undefined);
  assert.equal(left.isGameOver, false);
  const alone = removePlayer(sudoku, left, 3);
  assert.equal(alone.isGameOver, false);
  assert.deepEqual(alone.winners, []);
  assert.deepEqual(alone.activePlayers, [1]);
});

test('a player leaving Together leaves their entries on the board', () => {
  let state = lobby(2, 'together');
  state = act(state, 2, enter(0, wrong(state, 0)));
  const left = removePlayer(sudoku, state, 2);
  assert.equal(left.board.entries[0], wrong(state, 0));
  assert.equal(left.ownMoves[2], undefined);
  assert.equal(left.isGameOver, false);
});

test('finalStandings', () => {
  let solo = lobby(1, 'solo');
  for (const cell of EMPTY) solo = move(solo, 1, enter(cell, solo.solution[cell]));
  assert.deepEqual(sudoku.finalStandings!(solo), [{ seat: 1, place: 1, score: 'Solved' }]);

  let together = lobby(2, 'together');
  together = act(together, 1, enter(0, together.solution[0]));
  together = act(together, 1, enter(40, together.solution[40]));
  together = act(together, 2, enter(80, together.solution[80]));
  assert.deepEqual(sudoku.finalStandings!(together), [
    { seat: 1, place: 1, score: '2 squares' },
    { seat: 2, place: 1, score: '1 square' }
  ]);

  // Five open cells: 100%, 60%, 60% and 20% correct
  const open = [0, 20, 40, 60, 80];
  const base = lobby(4, 'race', open);
  const boardWith = (correct: number): Board => ({
    entries: base.solution.map((digit, cell) => (open.slice(0, correct).includes(cell) ? digit : 0)),
    by: base.solution.map(() => null)
  });
  const race = { ...base, isGameOver: true, winners: [1], raceBoards: { 1: boardWith(5), 2: boardWith(3), 3: boardWith(3), 4: boardWith(1) } };
  // The platform's rankStandings dense-ranks, so the last seat is third, not fourth
  assert.deepEqual(sudoku.finalStandings!(race), [
    { seat: 1, place: 1, score: 'Solved' },
    { seat: 2, place: 2, score: '60% correct' },
    { seat: 3, place: 2, score: '60% correct' },
    { seat: 4, place: 3, score: '20% correct' }
  ]);
});

test('allowsUndoVote only in Solo', () => {
  assert.equal(sudoku.allowsUndoVote!(lobby(1, 'solo')), true);
  assert.equal(sudoku.allowsUndoVote!(lobby(2, 'together')), false);
  assert.equal(sudoku.allowsUndoVote!(lobby(2, 'race')), false);
});

test('Together and Race have no turns; Solo keeps seat 1 to move', () => {
  assert.equal(lobby(1, 'solo').currentPlayer, 1);
  assert.equal(lobby(2, 'together').currentPlayer, null);
  assert.equal(lobby(3, 'race').currentPlayer, null);

  const together = lobby(3, 'together');
  let state = act(together, 1, enter(0, wrong(together, 0)));
  assert.equal(state.currentPlayer, null);
  state = removePlayer(sudoku, state, 2, seeded(1));
  assert.equal(state.currentPlayer, null);
  assert.equal(state.isGameOver, false);
  state = act(state, 3, enter(40, state.solution[40]));
  assert.equal(state.currentPlayer, null);
  assert.equal(undo(state, 3).currentPlayer, null);
});

test('re-entering the digit a square holds changes and records nothing', () => {
  for (const mode of ['together', 'race'] as const) {
    const state = act(lobby(2, mode), 1, enter(40, 5));
    const again = act(state, 1, enter(40, 5));
    assert.deepEqual(again, state);
    assert.equal(sudoku.recordsAction!(state, 1, enter(40, 5)), false);
    assert.equal(sudoku.recordsAction!(state, 1, enter(40, 6)), true);
    assert.equal(again.ownMoves[1]?.length, 1);
  }
});

test('Together: a second player typing the same correct digit is a silent no-op', () => {
  const together = lobby(2, 'together');
  const state = act(together, 1, enter(0, together.solution[0]));
  const second = act(state, 2, enter(0, state.solution[0]));
  assert.deepEqual(second, state);
  assert.equal(second.board.by[0], 1);
  assert.equal(sudoku.recordsAction!(state, 2, enter(0, state.solution[0])), false);
});

test('Solo refuses re-entering the digit a square holds', () => {
  const state = move(lobby(1, 'solo'), 1, enter(40, 5));
  assert.deepEqual(applyMove(sudoku, state, 1, enter(40, 5)), { error: 'That square already holds 5' });
});
