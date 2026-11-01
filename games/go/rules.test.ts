import { test } from 'node:test';
import assert from 'node:assert/strict';
import { go } from './index.ts';
import { describeHouseRules, houseRulesOf } from '../../shared/houseRules.ts';
import { withRules } from '../../server/testing.ts';
import { addPlayer, applyMove } from '../../shared/seating.ts';
import { boardOf } from './testBoards.ts';
import type { GameState, Move, Seat } from './types.ts';

function lobby(rules?: Record<string, number>): GameState {
  let state = go.createGameState('g1');
  for (const name of ['Alice', 'Bob']) {
    const result = addPlayer(go, state, name);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  if (rules) state = go.resetLobby({ ...state, houseRules: withRules(rules) }, Math.random);
  return { ...state, started: true };
}

const place = (row: number, col: number): Move => ({ type: 'place', row, col });
const PASS: Move = { type: 'pass' };

function play(state: GameState, seat: Seat, move: unknown): GameState {
  const result = applyMove(go, state, seat, move);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function koPosition(): GameState {
  const board = boardOf(['.XO', 'XO.O', '.XO'], 9);
  return { ...lobby({ boardSize: 9 }), board };
}

test('Black moves first and the turn alternates', () => {
  const state = play(lobby(), 1, place(3, 3));
  assert.equal(state.board[3][3], 'black');
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.gameStatus, 'Alice played D16');
});

test('the board size house rule sets the board, 19x19 standard', () => {
  const standard = lobby();
  assert.equal(standard.board.length, 19);
  assert.equal(standard.board[0].length, 19);
  const small = lobby({ boardSize: 9 });
  assert.equal(small.board.length, 9);
  assert.equal(small.board[0].length, 9);
  const lines = describeHouseRules(go.info, houseRulesOf(go.info, standard), 2).filter(line => line.label === 'Board size');
  assert.deepEqual(lines.map(line => [line.label, line.value, line.standard]), [['Board size', '19x19', true]]);
});

test('bad coordinates are refused', () => {
  const state = lobby({ boardSize: 9 });
  for (const bad of [{ row: -1, col: 0 }, { row: 1.5, col: 0 }, { row: '3', col: 0 }, { row: 12, col: 0 }, { row: 0 }, { row: 0, col: '0' }]) {
    assert.deepEqual(applyMove(go, state, 1, { type: 'place', ...bad }), { error: 'Invalid move' });
  }
  assert.deepEqual(applyMove(go, state, 1, 'place'), { error: 'Invalid move' });
});

test('a capture adds to the capturer\'s count', () => {
  const board = boardOf(['OX'], 9);
  const state = { ...lobby({ boardSize: 9 }), board, currentPlayer: 1 };
  const next = play(state, 1, place(1, 0));
  assert.equal(next.board[0][0], null);
  assert.equal(next.captures.black, 1);
  assert.equal(next.captures.white, 0);
  assert.equal(next.gameStatus, 'Alice played A8 and captured 1');
});

test('retaking a ko at once is refused', () => {
  const state = koPosition();
  const after = play(state, 1, place(1, 2));
  assert.equal(after.board[1][1], null);
  assert.deepEqual(applyMove(go, after, 2, place(1, 1)), { error: 'Ko: play elsewhere before retaking' });
});

test('the ko may be retaken after a move elsewhere by each player', () => {
  let state = play(koPosition(), 1, place(1, 2));
  state = play(state, 2, place(8, 8));
  state = play(state, 1, place(8, 0));
  state = play(state, 2, place(1, 1));
  assert.equal(state.lastMove?.type === 'place' && state.lastMove.captured, 1);
});

test('two passes in a row start marking; a stone between passes does not', () => {
  let state = play(play(lobby(), 1, PASS), 2, PASS);
  assert.equal(state.phase, 'marking');
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.passes, 2);
  state = play(play(play(lobby(), 1, PASS), 2, place(0, 0)), 1, PASS);
  assert.equal(state.phase, 'play');
  assert.equal(state.passes, 1);
});

test('no stone may be placed while marking', () => {
  const state = play(play(lobby(), 1, PASS), 2, PASS);
  assert.deepEqual(applyMove(go, state, 1, place(0, 0)), { error: 'Agree to the dead stones or resume play first' });
});

test('resign ends the game for the opponent', () => {
  const result = go.applyAction?.(lobby(), 1, { type: 'resign' }, Math.random, 0);
  assert.ok(result && 'state' in result);
  assert.equal(result.state.isGameOver, true);
  assert.deepEqual(result.state.winners, [2]);
  assert.equal(result.state.gameStatus, 'Alice resigned. Bob wins!');
});

test('draw offers are refused', () => {
  for (const action of [{ type: 'offerDraw' }, { type: 'answerDraw', accept: true }]) {
    assert.deepEqual(go.applyAction?.(lobby(), 1, action, Math.random, 0), { error: 'Go has no draw offers' });
  }
});
