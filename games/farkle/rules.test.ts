import { test } from 'node:test';
import assert from 'node:assert/strict';
import { farkle } from './index.ts';
import { FARKLE_RULES } from './options.ts';
import { targetScore } from './rules.ts';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import type { Random } from '../../shared/types.ts';
import { score } from './scoring.ts';
import type { GameState, Move } from './types.ts';

// Each value is one die, read in order
function dice(...values: number[]): Random {
  let next = 0;
  return () => (values[next++ % values.length] - 0.5) / 6;
}

function lobby(names = ['A', 'B', 'C'], fields: Partial<GameState> = {}): GameState {
  let state = { ...farkle.createGameState('g1'), ...fields };
  for (const name of names) {
    const added = addPlayer(farkle, state, name, dice(1));
    if ('error' in added) assert.fail(added.error);
    state = added.state;
  }
  return state;
}

// A started game in the middle of seat 1's turn with this roll in front of them
function turn(roll: number[], fields: Partial<GameState> = {}): GameState {
  return { ...lobby(), started: true, dice: roll, ...fields };
}

function play(state: GameState, seat: number, move: Move | object, random: Random = dice(1)): GameState {
  const result = applyMove(farkle, state, seat, move, random);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function refused(state: GameState, seat: number, move: unknown): string {
  const result = applyMove(farkle, state, seat, move, dice(1));
  if (!('error' in result)) assert.fail('expected the move to be refused');
  return result.error;
}

test('everyone starts on zero with seat 1 to roll', () => {
  const state = lobby();
  assert.deepEqual(state.scores, { 1: 0, 2: 0, 3: 0 });
  assert.equal(state.currentPlayer, 1);
  assert.deepEqual(state.dice, []);
  assert.equal(state.turnTotal, 0);
});

test('the first roll of a turn keeps nothing and throws six dice', () => {
  const state = play(lobby(), 1, { type: 'roll', keep: [] }, dice(1, 2, 3, 4, 5, 6));
  assert.deepEqual(state.dice, [1, 2, 3, 4, 5, 6]);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.lastMove?.type, 'roll');
});

test('a roll sets aside the chosen dice and throws the rest', () => {
  const state = play(turn([1, 2, 5, 3, 4, 6]), 1, { type: 'roll', keep: [0, 2] }, dice(2, 3, 4, 1));
  assert.equal(state.turnTotal, 150);
  assert.deepEqual(state.setAside, [1, 5]);
  assert.deepEqual(state.dice, [2, 3, 4, 1]);
});

test('a roll with nothing scoring farkles and ends the turn with zero', () => {
  const start = turn([1, 2, 3, 4, 6, 6], { turnTotal: 300, setAside: [5, 5, 5] });
  const state = play(start, 1, { type: 'roll', keep: [0] }, dice(2, 3, 4, 6, 6));
  assert.equal(state.scores[1], 0);
  assert.equal(state.turnTotal, 0);
  assert.deepEqual(state.dice, []);
  assert.deepEqual(state.setAside, []);
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.lastMove, { type: 'roll', playerNumber: 1, kept: [1], points: 100, dice: [2, 3, 4, 6, 6], hot: false, farkle: true, lost: 400 });
});

test('setting aside all six gives hot dice and a fresh six', () => {
  const state = play(turn([1, 1, 1, 5, 5, 5]), 1, { type: 'roll', keep: [0, 1, 2, 3, 4, 5] }, dice(2, 2, 3, 4, 6, 1));
  assert.equal(state.turnTotal, 1500);
  assert.deepEqual(state.setAside, []);
  assert.equal(state.dice.length, 6);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.lastMove?.type === 'roll' && state.lastMove.hot, true);
});

test('banking adds the turn total and the kept dice to the score and passes the turn', () => {
  const state = play(turn([1, 2, 3, 4, 6, 6], { turnTotal: 250, scores: { 1: 500, 2: 0, 3: 0 } }), 1, { type: 'bank', keep: [0] });
  assert.equal(state.scores[1], 850);
  assert.equal(state.turnTotal, 0);
  assert.deepEqual(state.dice, []);
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.lastMove, { type: 'bank', playerNumber: 1, kept: [1], points: 100, total: 350 });
});

test('a selection with a non-scoring die is refused', () => {
  const state = turn([1, 2, 5, 3, 4, 6]);
  assert.equal(refused(state, 1, { type: 'roll', keep: [0, 1] }), 'Every die you set aside must score');
  assert.equal(refused(state, 1, { type: 'bank', keep: [0, 3] }), 'Every die you set aside must score');
});

test('reaching 10,000 gives everyone else one more turn and the highest total wins', () => {
  let state = turn([1, 2, 3, 4, 6, 6], { turnTotal: 400, scores: { 1: 9600, 2: 9000, 3: 9900 } });
  state = play(state, 1, { type: 'bank', keep: [0] });
  assert.equal(state.scores[1], 10100);
  assert.equal(state.isGameOver, false);
  assert.equal(state.triggeredBy, 1);
  assert.deepEqual(state.finalTurns, [2, 3]);
  assert.equal(state.currentPlayer, 2);

  // Seat 2 banks past the trigger but short of the lead, seat 3 farkles on the first roll
  state = play({ ...state, dice: [1, 1, 1, 2, 3, 4] }, 2, { type: 'bank', keep: [0, 1, 2] });
  assert.equal(state.scores[2], 10000);
  assert.equal(state.isGameOver, false);
  assert.deepEqual(state.finalTurns, [3]);
  state = play(state, 3, { type: 'roll', keep: [] }, dice(2, 3, 4, 6, 6, 2));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.currentPlayer, null);
});

test('the highest total wins and equal totals share the win', () => {
  const start = turn([1, 1, 1, 2, 3, 4], { scores: { 1: 10100, 2: 9000, 3: 0 }, triggeredBy: 1, finalTurns: [2], currentPlayer: 2 });
  const passed = play(start, 2, { type: 'bank', keep: [0, 1, 2] });
  assert.equal(passed.scores[2], 10000);
  assert.deepEqual(passed.winners, [1]);
  const tied = play({ ...start, scores: { 1: 10000, 2: 9000, 3: 0 } }, 2, { type: 'bank', keep: [0, 1, 2] });
  const overtaken = play({ ...start, scores: { 1: 10100, 2: 9500, 3: 0 } }, 2, { type: 'bank', keep: [0, 1, 2] });
  assert.deepEqual(overtaken.winners, [2]);
  assert.deepEqual(tied.winners, [1, 2]);
});

test('invalid moves', () => {
  const mid = turn([1, 2, 5, 3, 4, 6]);
  const unchanged = (move: unknown) => {
    const error = refused(mid, 1, move);
    assert.ok(error);
  };
  for (const move of [null, 'roll', {}, { type: 'bank' }, { type: 'roll' }, { type: 'jump', keep: [] },
    { type: 'roll', keep: 'a' }, { type: 'roll', keep: [] }, { type: 'bank', keep: [] }, { type: 'roll', keep: [0, 0] },
    { type: 'roll', keep: [6] }, { type: 'roll', keep: [-1] }, { type: 'roll', keep: [0.5] }, { type: 'roll', keep: ['0'] }]) unchanged(move);
  // The first roll of a turn keeps nothing, and a turn cannot be banked before any roll
  assert.equal(refused(lobby(), 1, { type: 'roll', keep: [0] }), 'Nothing to set aside before the first roll');
  assert.equal(refused(lobby(), 1, { type: 'bank', keep: [] }), 'Roll before you bank');
  assert.equal(refused(lobby(), 2, { type: 'roll', keep: [] }), 'Not your turn');
});

test('dismissed player mid-turn', () => {
  const mid = turn([1, 2, 5, 3, 4, 6], { turnTotal: 300, setAside: [5, 5, 5], currentPlayer: 2,
    lastMove: { type: 'roll', playerNumber: 2, kept: [5], points: 50, dice: [1, 2, 5, 3, 4, 6], hot: false, farkle: false, lost: 0 } });
  const left = removePlayer(farkle, mid, 2, dice(1));
  assert.equal(left.currentPlayer, 3);
  assert.deepEqual(left.dice, []);
  assert.equal(left.turnTotal, 0);
  assert.deepEqual(left.setAside, []);
  assert.deepEqual(left.scores[2], 0);

  // A dismissed player no longer owes a last turn, and when none are owed the game ends
  const final = turn([1, 2, 3, 4, 6, 6], { scores: { 1: 10500, 2: 3000, 3: 9000 }, triggeredBy: 1, finalTurns: [2, 3], currentPlayer: 2 });
  const afterOne = removePlayer(farkle, final, 2, dice(1));
  assert.deepEqual(afterOne.finalTurns, [3]);
  assert.equal(afterOne.currentPlayer, 3);
  const afterBoth = removePlayer(farkle, { ...afterOne, currentPlayer: 3 }, 3, dice(1));
  assert.equal(afterBoth.isGameOver, true);
  assert.deepEqual(afterBoth.winners, [1]);
});

test('table view hides hands: nothing is hidden, so the history and every seat see the same state', () => {
  const state = turn([1, 2, 5, 3, 4, 6], { turnTotal: 100, setAside: [1] });
  const table = farkle.toPublicState(state, false, null);
  for (const seat of [1, 2, 3]) assert.deepEqual(farkle.toPublicState(state, false, seat), table);
  assert.deepEqual(table.dice, [1, 2, 5, 3, 4, 6]);
});

test('the game ends at the target score the host chose', () => {
  const chosen = (value: number) => turn([1, 2, 3, 4, 6, 6], {
    turnTotal: 4900, scores: { 1: 0, 2: 0, 3: 0 },
    houseRules: { host: 1, values: { targetScore: value }, override: false, maxPlayers: null, agreed: [], revision: 0 }
  });
  assert.equal(targetScore(chosen(5000)), 5000);
  const banked = play(chosen(5000), 1, { type: 'bank', keep: [0] });
  assert.equal(banked.triggeredBy, 1);
  assert.deepEqual(banked.finalTurns, [2, 3]);
  const standard = play(chosen(FARKLE_RULES[0].standard as number), 1, { type: 'bank', keep: [0] });
  assert.equal(standard.triggeredBy, null);
  assert.equal(targetScore({}), 10000);
});

test('ten players can play a full game', () => {
  let seed = 7;
  const random: Random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const names = Array.from({ length: 10 }, (_, index) => `P${index + 1}`);
  const tenSeats = { host: 1, values: { targetScore: 5000 }, override: true, maxPlayers: 10, agreed: [], revision: 0 };
  let state: GameState = { ...lobby(names, { houseRules: tenSeats }), started: true };
  assert.equal(state.activePlayers.length, 10);
  for (let step = 0; step < 100000 && !state.isGameOver; step++) {
    const seat = state.currentPlayer as number;
    // The best-scoring subset of the roll
    let keep: number[] = [];
    let best = 0;
    for (let mask = 1; mask < 1 << state.dice.length; mask++) {
      const picked = state.dice.map((_, index) => index).filter(index => mask & (1 << index));
      const points = score(picked.map(index => state.dice[index]));
      if (points !== null && points > best) { best = points; keep = picked; }
    }
    const bankNow = state.dice.length > 0 && state.turnTotal + best >= 300;
    state = play(state, seat, { type: bankNow ? 'bank' : 'roll', keep }, random);
  }
  assert.equal(state.isGameOver, true);
  assert.ok(state.winners.length >= 1);
});
