import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction, applyMove, createGameState, finalStandings, onPlayerLeft, progressOf, recordsAction, resetLobby, undoOwn, waitingOn
} from './rules.ts';
import { COLORS } from './options.ts';
import type { Board, Color, GameState, Seat } from './types.ts';
import { withRules } from '../../server/testing.ts';
import { seeded } from '../testStates.ts';
import type { HouseRuleValues } from '../../shared/houseRules.ts';

const CODE: Color[] = ['red', 'blue', 'green', 'yellow'];
const WRONG: Color[] = ['purple', 'purple', 'purple', 'purple'];
const CLOSE: Color[] = ['red', 'blue', 'purple', 'purple']; // 2 exact

const NAMES = { 1: 'Alice', 2: 'Bob', 3: 'Cara' };

// A started game at `seats` with the drawn code replaced by CODE
function lobby(mode: string, seats: Seat[] = [1, 2], code = '4of6'): GameState {
  const state: GameState = {
    ...createGameState('g1'),
    activePlayers: seats,
    currentPlayer: seats[0],
    playerNames: NAMES,
    houseRules: withRules({ mode, code } as HouseRuleValues)
  };
  return { ...resetLobby(state, seeded(3)), started: true, code: CODE };
}

function ok(result: { state: GameState } | { error: string }): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const guess = (state: GameState, seat: Seat, pegs: Color[]): GameState => ok(applyAction(state, seat, { type: 'guess', pegs }));
const guesses = (state: GameState, seat: Seat, count: number, pegs = WRONG): GameState => {
  for (let i = 0; i < count; i++) state = guess(state, seat, pegs);
  return state;
};
const soloGuess = (state: GameState, pegs: Color[]): GameState => ok(applyMove(state, 1, { type: 'guess', pegs }));
const boardOf = (state: GameState, seat: Seat): Board => state.boards[seat] as Board;

test('Solo: the computer draws a code of the rule\'s length', () => {
  const base: GameState = { ...createGameState('g1'), activePlayers: [1], currentPlayer: 1, playerNames: NAMES, houseRules: withRules({ mode: 'solo', code: '5of8' }) };
  const long = resetLobby(base, seeded(5));
  assert.equal(long.code?.length, 5);
  assert.ok(long.code?.every(peg => COLORS.includes(peg)));
  assert.equal(long.maker, null);
  const short = resetLobby({ ...long, houseRules: withRules({ mode: 'solo', code: '4of6' }) }, seeded(5));
  assert.equal(short.code?.length, 4);
  assert.ok(short.code?.every(peg => COLORS.slice(0, 6).includes(peg)));
  assert.equal(short.currentPlayer, 1);
  assert.ok(!short.gameStatus.includes('red'));
});

test('Solo: breaking wins, ten misses lose', () => {
  const won = soloGuess(soloGuess(lobby('solo', [1]), WRONG), CODE);
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1]);
  assert.deepEqual(finalStandings(won), [{ seat: 1, place: 1, score: 'Broken in 2 guesses' }]);
  let lost = lobby('solo', [1]);
  for (let i = 0; i < 9; i++) lost = soloGuess(lost, WRONG);
  assert.equal(lost.isGameOver, false);
  lost = soloGuess(lost, WRONG);
  assert.equal(lost.isGameOver, true);
  assert.deepEqual(lost.winners, []);
  assert.equal(lost.gameStatus, 'The code was not broken');
  assert.equal(finalStandings(lost)[0].score, 'Not broken');
  assert.deepEqual(undoOwn(won, 1), { error: 'Use Undo' });
});

test('Together: any seat may guess and contributions count each', () => {
  const state = guess(guess(guess(lobby('together'), 1, WRONG), 2, WRONG), 1, WRONG);
  assert.deepEqual(state.contributions, { 1: 2, 2: 1 });
  assert.equal(state.currentPlayer, null);
  assert.deepEqual(state.board.guesses.map(g => g.by), [1, 2, 1]);
  assert.deepEqual(waitingOn(state), []);
  const won = guess(state, 2, CODE);
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1, 2]);
  assert.equal(finalStandings(won).find(row => row.seat === 1)?.score, '2 guesses');
});

test('Together: undoOwn takes back only my last guess', () => {
  const state = guess(guess(guess(guess(lobby('together', [1, 2, 3]), 1, WRONG), 2, CLOSE), 1, CLOSE), 2, WRONG);
  const undone = ok(undoOwn(state, 1));
  assert.deepEqual(undone.board.guesses.map(g => g.by), [1, 2, 2]);
  assert.deepEqual(undone.board.guesses.map(g => g.pegs), [WRONG, CLOSE, WRONG]);
  assert.deepEqual(undone.contributions, { 1: 1, 2: 2 });
  assert.deepEqual(undoOwn(state, 3), { error: 'Nothing of yours to undo' });
});

test('Race: each board is its own', () => {
  const state = guess(lobby('race'), 1, WRONG);
  assert.equal(state.currentPlayer, null);
  assert.equal(boardOf(state, 1).guesses.length, 1);
  assert.equal(boardOf(state, 2).guesses.length, 0);
  assert.deepEqual(state.lastMove, { type: 'raceGuess', playerNumber: 1, guessNumber: 1, broken: false });
  assert.deepEqual(waitingOn(state), [1, 2]);
});

test('Race: a player who can still match the best keeps the game going', () => {
  let state = guess(guesses(lobby('race'), 1, 3), 1, CODE);
  state = guesses(state, 2, 3);
  assert.equal(state.isGameOver, false);
  assert.deepEqual(waitingOn(state), [2]);
  state = guess(state, 2, WRONG);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
});

test('Race: a tie in guesses goes to who finished first', () => {
  let state = guess(guesses(lobby('race', [1, 2, 3]), 1, 3), 1, CODE);
  state = guess(guesses(state, 2, 3), 2, CODE);
  state = guesses(state, 3, 4);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  const standings = finalStandings(state);
  assert.deepEqual(standings.map(row => [row.seat, row.place]), [[1, 1], [2, 2], [3, 3]]);
  assert.equal(standings[1].score, 'Broken in 4 guesses');
});

test('Race: nobody breaks it and every board runs out', () => {
  let state = guesses(lobby('race', [1, 2, 3]), 1, 10);
  state = guesses(guesses(state, 2, 9), 2, 1, CLOSE);
  state = guesses(state, 3, 10);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, []);
  assert.equal(progressOf(boardOf(state, 2), 4), 50);
  assert.equal(progressOf(boardOf(state, 1), 4), 0);
  assert.deepEqual(finalStandings(state).map(row => [row.seat, row.place]), [[2, 1], [1, 2], [3, 2]]);
});

test('Race: undoOwn is refused on a finished board', () => {
  const state = guesses(guess(guesses(lobby('race'), 1, 2), 1, CODE), 2, 1);
  assert.deepEqual(undoOwn(state, 1), { error: 'Your board is finished' });
  const undone = ok(undoOwn(state, 2));
  assert.equal(boardOf(undone, 2).guesses.length, 0);
  assert.deepEqual(undoOwn(undone, 2), { error: 'Nothing of yours to undo' });
});

test('Race: a guess on a finished board is refused', () => {
  const state = guess(lobby('race'), 1, CODE);
  assert.deepEqual(applyAction(state, 1, { type: 'guess', pegs: WRONG }), { error: 'Your board is finished' });
});

test('Race: the last player still guessing leaving ends the game', () => {
  let state = guess(guesses(lobby('race', [1, 2, 3]), 1, 4), 1, CODE);
  state = guesses(state, 3, 10);
  state = guesses(state, 2, 2);
  assert.equal(state.isGameOver, false);
  const left = onPlayerLeft({ ...state, activePlayers: [1, 3] }, 2);
  assert.equal(left.isGameOver, true);
  assert.deepEqual(left.winners, [1]);
  assert.equal(left.boards[2], undefined);
});

test('recordsAction is true for a Together or Race guess and false in Classic', () => {
  const action = { type: 'guess', pegs: WRONG };
  assert.equal(recordsAction(lobby('together'), 1, action), true);
  assert.equal(recordsAction(lobby('race'), 1, action), true);
  assert.equal(recordsAction(lobby('classic'), 1, action), false);
  assert.equal(recordsAction(lobby('race'), 1, { type: 'continue' }), false);
});
