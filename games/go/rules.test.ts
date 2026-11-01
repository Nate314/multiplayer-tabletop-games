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

const walls = (): string[] => {
  const rows = Array<string>(9).fill('....XO...');
  rows[4] = '.O..XO...';
  return rows;
};
const WRONG_PHASE = 'Stones are marked only after both players pass';

function marking(): GameState {
  return { ...lobby({ boardSize: 9 }), board: boardOf(walls(), 9), phase: 'marking', passes: 2 };
}

function act(state: GameState, seat: Seat, action: unknown): GameState {
  const result = go.applyAction?.(state, seat, action, Math.random, 0);
  if (!result) assert.fail('no applyAction');
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

test('marking a stone marks its whole chain, and again unmarks it', () => {
  let state = { ...marking(), board: boardOf(['.OO', '..O', 'XXX'], 9) };
  state = act(state, 1, { type: 'mark', row: 0, col: 1 });
  assert.deepEqual([...state.dead].sort((a, b) => a.row - b.row || a.col - b.col), [
    { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 2 }
  ]);
  state = act(state, 2, { type: 'mark', row: 1, col: 2 });
  assert.deepEqual(state.dead, []);
});

test('marking an empty point is refused', () => {
  assert.deepEqual(go.applyAction?.(marking(), 1, { type: 'mark', row: 0, col: 0 }, Math.random, 0), { error: 'There is no stone there' });
});

test('bad coordinates, and marks outside marking, are refused', () => {
  for (const bad of [{ row: -1, col: 0 }, { row: 9, col: 0 }, { row: 1.5, col: 1 }, { row: '4', col: 1 }, {}]) {
    assert.deepEqual(go.applyAction?.(marking(), 1, { type: 'mark', ...bad }, Math.random, 0), { error: 'Invalid move' });
  }
  const playing = lobby({ boardSize: 9 });
  for (const action of [{ type: 'mark', row: 0, col: 0 }, { type: 'agree' }, { type: 'resume' }]) {
    assert.deepEqual(go.applyAction?.(playing, 1, action, Math.random, 0), { error: WRONG_PHASE });
  }
});

test('a mark clears both agreements', () => {
  let state = act(marking(), 1, { type: 'agree' });
  assert.deepEqual(state.agreed, [1]);
  assert.deepEqual(go.applyAction?.(state, 1, { type: 'agree' }, Math.random, 0), { error: 'You have already agreed' });
  state = act(state, 2, { type: 'mark', row: 4, col: 1 });
  assert.deepEqual(state.agreed, []);
});

test('when both agree the score is counted and the higher total wins', () => {
  let state = act(marking(), 1, { type: 'mark', row: 4, col: 1 });
  state = act(state, 1, { type: 'agree' });
  assert.equal(state.isGameOver, false);
  state = act(state, 2, { type: 'agree' });
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.score?.black.total, 45);
  assert.equal(state.score?.white.total, 43.5);
  assert.equal(state.board[4][1], null);
  assert.equal(state.gameStatus, 'Alice wins by 1.5 (Black 45, White 43.5)');
});

test('resume play clears marks and passes and keeps the turn', () => {
  let state = act(marking(), 1, { type: 'mark', row: 4, col: 1 });
  state = act(state, 2, { type: 'resume' });
  assert.equal(state.phase, 'play');
  assert.equal(state.passes, 0);
  assert.deepEqual(state.dead, []);
  assert.deepEqual(state.agreed, []);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.gameStatus, 'Bob resumed play. Alice to move');
  state = play(state, 1, PASS);
  assert.equal(state.phase, 'play');
  assert.equal(state.board[4][1], 'white');
});

test('the projected score shows only while marking', () => {
  const state = act(marking(), 1, { type: 'mark', row: 4, col: 1 });
  assert.equal(go.toPublicState(state, false, null).projected?.black.total, 45);
  assert.equal(go.toPublicState(lobby(), false, null).projected, null);
});

test('recordsAction is true only for the agreement that finishes the count', () => {
  const state = marking();
  const agreed = act(state, 1, { type: 'agree' });
  assert.equal(go.recordsAction?.(state, 1, { type: 'agree' }), false);
  assert.equal(go.recordsAction?.(agreed, 2, { type: 'agree' }), true);
  assert.equal(go.recordsAction?.(agreed, 2, { type: 'mark', row: 4, col: 1 }), false);
  assert.equal(go.recordsAction?.(agreed, 2, { type: 'resume' }), false);
  assert.equal(go.recordsAction?.(lobby(), 2, { type: 'agree' }), false);
});

test('waitingOn lists the seats yet to agree', () => {
  const state = marking();
  assert.deepEqual(go.waitingOn?.(state), [1, 2]);
  assert.deepEqual(go.waitingOn?.(act(state, 1, { type: 'agree' })), [2]);
  assert.deepEqual(go.waitingOn?.(lobby()), []);
});

test('finalStandings gives the winner place 1 with points', () => {
  let state = act(marking(), 1, { type: 'mark', row: 4, col: 1 });
  state = act(act(state, 1, { type: 'agree' }), 2, { type: 'agree' });
  assert.deepEqual(go.finalStandings?.(state), [{ seat: 1, place: 1, score: '45 points' }, { seat: 2, place: 2, score: '43.5 points' }]);
  const resigned = act(lobby(), 1, { type: 'resign' });
  assert.deepEqual(go.finalStandings?.(resigned), [{ seat: 2, place: 1 }, { seat: 1, place: 2 }]);
});

test('finalStandings has no seatless row when the other player left', () => {
  const left = { ...act(lobby(), 1, { type: 'resign' }), activePlayers: [2 as Seat] };
  assert.deepEqual(go.finalStandings?.(left), [{ seat: 2, place: 1 }]);
});

test('resign works while marking', () => {
  const state = act(marking(), 2, { type: 'resign' });
  assert.deepEqual(state.winners, [1]);
});

test('marking actions are refused when the game is over or a vote is open', () => {
  const over = { ...marking(), isGameOver: true };
  assert.deepEqual(go.applyAction?.(over, 1, { type: 'agree' }, Math.random, 0), { error: 'The game is over' });
  const voting = { ...marking(), undoVote: { requestedBy: 1 as Seat, votes: { 1: true, 2: false } } };
  assert.deepEqual(go.applyAction?.(voting, 1, { type: 'mark', row: 4, col: 1 }, Math.random, 0), { error: 'A vote is in progress' });
});
