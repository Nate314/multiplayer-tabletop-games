import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, applyMove, createGameState, finalStandings, onPlayerDisconnected, onPlayerLeft, resetLobby, waitingOn } from './rules.ts';
import { feedback } from './feedback.ts';
import { COLORS } from './options.ts';
import type { Color, GameState, Seat } from './types.ts';
import { withRules } from '../../server/testing.ts';
import type { HouseRuleValues } from '../../shared/houseRules.ts';

const CODE: Color[] = ['red', 'blue', 'green', 'yellow'];
const WRONG: Color[] = ['purple', 'purple', 'purple', 'purple'];

function lobby(values: HouseRuleValues = { mode: 'classic', code: '4of6' }): GameState {
  const state: GameState = {
    ...createGameState('g1'),
    activePlayers: [1, 2],
    playerNames: { 1: 'Alice', 2: 'Bob' },
    houseRules: withRules(values)
  };
  return { ...resetLobby(state), started: true };
}

function move(state: GameState, seat: Seat, type: string, pegs: Color[]): GameState {
  const result = applyMove(state, seat, { type, pegs });
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function play(state: GameState, seat: Seat): GameState {
  const result = applyAction(state, seat, { type: 'continue' });
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// The current maker sets CODE, then the breaker makes `guesses` wrong guesses and, if `breaks`, a right one
function round(state: GameState, guesses: number, breaks: boolean): GameState {
  let next = move(state, state.currentPlayer as Seat, 'setCode', CODE);
  const breaker = next.currentPlayer as Seat;
  for (let i = 0; i < guesses; i++) next = move(next, breaker, 'guess', WRONG);
  return breaks ? move(next, breaker, 'guess', CODE) : next;
}

const bothContinue = (state: GameState): GameState => play(play(state, 1), 2);

test('the maker sets a code and the breaker guesses', () => {
  const state = lobby();
  assert.equal(state.phase, 'setting');
  assert.equal(state.currentPlayer, 1);
  assert.deepEqual(applyMove(state, 1, { type: 'guess', pegs: CODE }), { error: 'Wait for the code' });
  const set = move(state, 1, 'setCode', CODE);
  assert.equal(set.currentPlayer, 2);
  assert.equal(set.phase, 'breaking');
});

test('a code of the wrong length or color is refused', () => {
  assert.deepEqual(applyMove(lobby(), 1, { type: 'setCode', pegs: ['red', 'red', 'red'] }), { error: 'Pick 4 colors' });
  assert.deepEqual(applyMove(lobby(), 1, { type: 'setCode', pegs: ['red', 'red', 'red', 'pink'] }), { error: 'Pick 4 colors' });
  assert.deepEqual(applyMove(lobby({ mode: 'classic', code: '5of8' }), 1, { type: 'setCode', pegs: CODE }), { error: 'Pick 5 colors' });
});

test('each guess gets its feedback', () => {
  const pegs: Color[] = ['green', 'blue', 'red', 'red'];
  const state = move(move(lobby(), 1, 'setCode', CODE), 2, 'guess', pegs);
  assert.deepEqual(state.board.guesses[0].feedback, feedback(CODE, pegs));
  assert.equal(state.board.guesses[0].by, 2);
});

test('breaking in 3 scores 3, failing all 10 scores 11', () => {
  const broke = round(lobby(), 2, true);
  assert.equal(broke.phase, 'summary');
  assert.equal(broke.points[2], 3);
  assert.equal(broke.gameStatus, 'Bob broke the code in 3 guesses');
  assert.deepEqual(broke.summary, { ...broke.rounds[0], acknowledged: [] });
  const failed = round(lobby(), 10, false);
  assert.equal(failed.points[2], 11);
  assert.equal(failed.gameStatus, 'Bob ran out of guesses');
  assert.equal(failed.rounds[0].broken, false);
});

test('rounds alternate maker and the game ends after 4 rounds with the lowest total winning', () => {
  let state = lobby();
  const guessesPerRound = [[2, true], [4, true], [0, true], [10, false]] as const; // seat 2 scores 3, seat 1 scores 5, seat 2 scores 1, seat 1 scores 11
  const makers: Seat[] = [];
  for (const [guesses, breaks] of guessesPerRound) {
    makers.push(state.currentPlayer as Seat);
    state = bothContinue(round(state, guesses, breaks));
  }
  assert.deepEqual(makers, [1, 2, 1, 2]);
  assert.deepEqual(state.points, { 2: 4, 1: 16 }); // seat 2 broke twice (3 + 1), seat 1 once broken in 5 and once failed (11)
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [2]);
  assert.equal(state.gameStatus, 'Bob won with 4 points');
});

test('a tie shares the win', () => {
  let state = lobby();
  for (const [guesses, breaks] of [[2, true], [4, true], [4, true], [2, true]] as const) state = bothContinue(round(state, guesses, breaks));
  assert.deepEqual(state.winners, [1, 2]);
  assert.equal(state.gameStatus, 'Alice and Bob tied with 8 points');
  assert.deepEqual(finalStandings(state).map(row => row.place), [1, 1]);
});

test('Continue waits for both players', () => {
  const state = round(lobby(), 0, true);
  assert.deepEqual(waitingOn(state), [1, 2]);
  const one = play(state, 1);
  assert.deepEqual(waitingOn(one), [2]);
  assert.equal(one.phase, 'summary');
  assert.equal(bothContinue(state).round, 2);
  assert.deepEqual(waitingOn(lobby()), []);
  assert.deepEqual(applyAction(lobby(), 1, { type: 'continue' }), { error: 'Nothing to continue' });
});

test('status and lastMove never hold the code', () => {
  const holdsColor = (state: GameState) => COLORS.some(color => JSON.stringify({ s: state.gameStatus, m: state.lastMove }).includes(color));
  let state = lobby();
  const steps: GameState[] = [];
  state = move(state, 1, 'setCode', CODE);
  steps.push(state);
  state = move(state, 2, 'guess', ['green', 'blue', 'red', 'red']);
  steps.push(state);
  state = move(state, 2, 'guess', CODE);
  steps.push(state);
  steps.push(play(state, 1));
  for (const step of steps) assert.equal(holdsColor(step), false);
});

test('the player left behind wins', () => {
  const mid = move(lobby(), 1, 'setCode', CODE);
  const left = onPlayerLeft({ ...mid, activePlayers: [1] });
  assert.equal(left.isGameOver, true);
  assert.deepEqual(left.winners, [1]);
  assert.equal(left.gameStatus, 'Alice wins! Everyone else left.');
  assert.deepEqual(finalStandings({ ...left, activePlayers: [1, 2] }).map(row => [row.seat, row.place]), [[1, 1], [2, 2]]);
});

test('the next round starts when the only player not ready disconnects', () => {
  const one = play(round(lobby(), 0, true), 1);
  assert.equal(onPlayerDisconnected(one).phase, 'summary');
  const gone = onPlayerDisconnected({ ...one, disconnected: [2] });
  assert.equal(gone.round, 2);
  assert.equal(gone.phase, 'setting');
});

test('an invalid guess and a second code are refused', () => {
  const set = move(lobby(), 1, 'setCode', CODE);
  assert.deepEqual(applyMove(set, 2, { type: 'guess', pegs: ['red', 'red', 'red', 'pink'] }), { error: 'Pick 4 colors' });
  assert.ok('error' in applyMove(set, 1, { type: 'setCode', pegs: CODE }));
});
