import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  POINT_COUNT,
  pointIndex,
  pointNumber,
  startingPosition,
  diceToPlay,
  applyStep,
  maxDiceUsable,
  legalSteps
} from './rules.ts';
import { backgammon } from './index.ts';
import { addPlayer, applyMove } from '../../shared/seating.ts';
import type { Random } from '../../shared/types.ts';
import type { GameState, Move, PointStack, Position, Seat } from './types.ts';

// Checkers per point number as that seat counts them, plus the bar and borne off
type Layout = { points?: Record<number, number>; bar?: number; off?: number };

function position(layouts: Record<Seat, Layout>): Position {
  const points: (PointStack | null)[] = Array(POINT_COUNT).fill(null);
  const bar: Record<Seat, number> = {};
  const borneOff: Record<Seat, number> = {};
  for (const [key, layout] of Object.entries(layouts)) {
    const seat = Number(key);
    for (const [number, count] of Object.entries(layout.points ?? {})) {
      points[pointIndex(seat, Number(number))] = { seat, count };
    }
    bar[seat] = layout.bar ?? 0;
    borneOff[seat] = layout.off ?? 0;
  }
  return { points, bar, borneOff };
}

// Each value is one die, read in order
function dice(...values: number[]): Random {
  let next = 0;
  return () => (values[next++ % values.length] - 0.5) / 6;
}

function seated(result: ReturnType<typeof addPlayer<GameState>>) {
  if ('error' in result) assert.fail(result.error);
  return result;
}

function lobby(random: Random = dice(3, 1)): GameState {
  let state = backgammon.createGameState('g1');
  for (const name of ['A', 'B']) state = seated(addPlayer(backgammon, state, name, random)).state;
  return state;
}

// A started game in the given position with seat 1 to play `remaining`
function midGame(layouts: Record<Seat, Layout>, remaining: number[]): GameState {
  return { ...lobby(), ...position(layouts), started: true, dice: remaining.slice(0, 2), remaining };
}

function play(state: GameState, seat: Seat, move: Move, random: Random = dice(1, 2)): GameState {
  const result = applyMove(backgammon, state, seat, move, random);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const move = (from: Move['from'], to: Move['to']): Move => ({ type: 'move', from, to });

test('point numbers count from each side', () => {
  assert.equal(pointNumber(1, 0), 1);
  assert.equal(pointNumber(2, 0), 24);
  assert.equal(pointIndex(2, 1), 23);
  for (let index = 0; index < POINT_COUNT; index++) {
    assert.equal(pointIndex(2, pointNumber(2, index)), index);
  }
});

test('both players start with fifteen checkers in the standard layout', () => {
  const { points, bar, borneOff } = startingPosition([1, 2]);
  for (const seat of [1, 2]) {
    const total = points.reduce((sum, point) => sum + (point?.seat === seat ? point.count : 0), 0);
    assert.equal(total, 15);
  }
  assert.deepEqual(points[23], { seat: 1, count: 2 });
  assert.deepEqual(points[5], { seat: 1, count: 5 });
  assert.deepEqual(points[0], { seat: 2, count: 2 });
  assert.deepEqual(points[18], { seat: 2, count: 5 });
  assert.deepEqual(bar, { 1: 0, 2: 0 });
  assert.deepEqual(borneOff, { 1: 0, 2: 0 });
});

test('doubles are played four times', () => {
  assert.deepEqual(diceToPlay([4, 4]), [4, 4, 4, 4]);
  assert.deepEqual(diceToPlay([2, 5]), [2, 5]);
});

test('the first player has rolled once both players are seated', () => {
  let state = backgammon.createGameState('g1');
  state = seated(addPlayer(backgammon, state, 'A', dice(6, 5))).state;
  assert.deepEqual(state.dice, []);
  state = seated(addPlayer(backgammon, state, 'B', dice(6, 5))).state;
  assert.equal(state.currentPlayer, 1);
  assert.deepEqual(state.dice, [6, 5]);
  assert.deepEqual(state.remaining, [6, 5]);
});

test('a checker on the bar must enter first', () => {
  const state = midGame({ 1: { points: { 13: 2 }, bar: 1 }, 2: { points: { 1: 2 } } }, [3, 5]);
  assert.deepEqual(legalSteps(state, 1), [
    { from: 'bar', to: pointIndex(1, 22), die: 3 },
    { from: 'bar', to: pointIndex(1, 20), die: 5 }
  ]);
  assert.deepEqual(applyMove(backgammon, state, 1, move(pointIndex(1, 13), pointIndex(1, 10))), { error: 'Invalid move' });
});

test('a checker cannot enter or land on two or more opposing checkers', () => {
  // Seat 2's points 3 and 5 are seat 1's points 22 and 20
  const state = midGame({ 1: { points: { 13: 1 }, bar: 1 }, 2: { points: { 3: 2, 5: 3 } } }, [3, 5]);
  assert.deepEqual(legalSteps(state, 1), []);
  const blocked = midGame({ 1: { points: { 13: 1 } }, 2: { points: { 15: 2 } } }, [3]);
  assert.deepEqual(legalSteps(blocked, 1), []);
});

test('hitting a blot sends it to the bar', () => {
  const before = position({ 1: { points: { 13: 1 } }, 2: { points: { 15: 1 } } });
  const after = applyStep(before, 1, { from: pointIndex(1, 13), to: pointIndex(1, 10), die: 3 });
  assert.deepEqual(after.points[pointIndex(1, 10)], { seat: 1, count: 1 });
  assert.equal(after.points[pointIndex(1, 13)], null);
  assert.deepEqual(after.bar, { 1: 0, 2: 1 });
});

test('a hit is recorded in the last move', () => {
  const state = play(midGame({ 1: { points: { 13: 1, 6: 2 } }, 2: { points: { 15: 1 } } }, [3, 1]), 1,
    move(pointIndex(1, 13), pointIndex(1, 10)));
  assert.deepEqual(state.lastMove, { playerNumber: 1, from: pointIndex(1, 13), to: pointIndex(1, 10), hit: true });
  assert.equal(state.gameStatus, 'A moved 13 to 10 and hit');
  assert.deepEqual(state.bar, { 1: 0, 2: 1 });
});

test('bearing off needs every checker in the home board', () => {
  const outside = midGame({ 1: { points: { 3: 2, 7: 1 } }, 2: { points: { 24: 2 } } }, [3]);
  assert.equal(legalSteps(outside, 1).some(step => step.to === 'off'), false);
  const home = midGame({ 1: { points: { 3: 2, 6: 1 } }, 2: { points: { 24: 2 } } }, [3]);
  assert.equal(legalSteps(home, 1).some(step => step.to === 'off'), true);
});

test('a higher die bears off only from the highest occupied point', () => {
  const state = midGame({ 1: { points: { 2: 1, 4: 1 } }, 2: { points: { 24: 2 } } }, [6]);
  assert.deepEqual(legalSteps(state, 1), [{ from: pointIndex(1, 4), to: 'off', die: 6 }]);
});

test('a move that leaves a die unplayable is refused when both dice can be played', () => {
  // Points 17 and 16 are blocked: 24 to 19 leaves the 3 unplayable, but 24 to 21 or 20 to 15 do not
  const state = midGame({ 1: { points: { 24: 1, 20: 1 } }, 2: { points: { 8: 2, 9: 2 } } }, [3, 5]);
  assert.equal(maxDiceUsable(state, 1, [3, 5]), 2);
  assert.deepEqual(legalSteps(state, 1), [
    { from: pointIndex(1, 24), to: pointIndex(1, 21), die: 3 },
    { from: pointIndex(1, 20), to: pointIndex(1, 15), die: 5 }
  ]);
});

test('when only one die can be played, it must be the higher one', () => {
  // Point 16 is blocked, so 24 can play the 6 or the 2 but not both
  const state = midGame({ 1: { points: { 24: 1 } }, 2: { points: { 9: 2 } } }, [6, 2]);
  assert.deepEqual(legalSteps(state, 1), [{ from: pointIndex(1, 24), to: pointIndex(1, 18), die: 6 }]);
});

test('the turn stays until every playable die is used, then the next player rolls', () => {
  const start = lobby(dice(3, 1, 6, 5));
  let state = play(start, 1, move(pointIndex(1, 8), pointIndex(1, 5)), dice(6, 5));
  assert.equal(state.currentPlayer, 1);
  assert.deepEqual(state.remaining, [1]);
  state = play(state, 1, move(pointIndex(1, 6), pointIndex(1, 5)), dice(6, 5));
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.dice, [6, 5]);
  assert.deepEqual(state.remaining, [6, 5]);
  assert.equal(state.gameStatus, 'A moved 6 to 5');
});

test('doubles give four moves', () => {
  let state = lobby(dice(2, 2));
  assert.deepEqual(state.remaining, [2, 2, 2, 2]);
  for (let count = 0; count < 3; count++) state = play(state, 1, move(pointIndex(1, 6), pointIndex(1, 4)));
  assert.equal(state.currentPlayer, 1);
  state = play(state, 1, move(pointIndex(1, 6), pointIndex(1, 4)));
  assert.equal(state.currentPlayer, 2);
});

test('a player who cannot move passes and the turn returns', () => {
  // Seat 2 is on the bar and seat 1 holds its whole home board
  const home = { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 };
  const state = midGame({ 1: { points: { ...home, 13: 1 } }, 2: { points: { 24: 2 }, bar: 1 } }, [1]);
  const next = play(state, 1, move(pointIndex(1, 13), pointIndex(1, 12)), dice(4, 3, 5, 2));
  assert.equal(next.currentPlayer, 1);
  assert.deepEqual(next.dice, [5, 2]);
  assert.equal(next.gameStatus, 'A moved 13 to 12. B rolled 4 and 3 and could not move');
});

test('bearing off the last checker wins, with a gammon when the loser has borne off none', () => {
  const layouts = (loser: Layout) => ({ 1: { points: { 1: 1 }, off: 14 }, 2: loser });
  const plain = play(midGame(layouts({ points: { 6: 14 }, off: 1 }), [3]), 1, move(pointIndex(1, 1), 'off'));
  assert.equal(plain.isGameOver, true);
  assert.deepEqual(plain.winners, [1]);
  assert.equal(plain.gameStatus, 'A wins!');
  const gammon = play(midGame(layouts({ points: { 6: 15 } }), [3]), 1, move(pointIndex(1, 1), 'off'));
  assert.equal(gammon.gameStatus, 'A wins with a gammon!');
  // Seat 2's point 20 is in seat 1's home board
  const backgammonWin = play(midGame(layouts({ points: { 6: 14, 20: 1 } }), [3]), 1, move(pointIndex(1, 1), 'off'));
  assert.equal(backgammonWin.gameStatus, 'A wins with a backgammon!');
  assert.deepEqual(applyMove(backgammon, plain, 1, move(0, 'off')), { error: 'The game is over' });
});

test('rejects malformed and illegal moves', () => {
  const state = lobby(dice(3, 1));
  assert.deepEqual(applyMove(backgammon, state, 2, move(0, 3)), { error: 'Not your turn' });
  assert.deepEqual(applyMove(backgammon, state, 1, move(pointIndex(1, 8), pointIndex(1, 3))), { error: 'Invalid move' });
  assert.deepEqual(applyMove(backgammon, state, 1, { type: 'move', from: '7', to: 4 }), { error: 'Invalid move' });
  assert.deepEqual(applyMove(backgammon, state, 1, { type: 'move', from: 'bar', to: 21 }), { error: 'Invalid move' });
  assert.deepEqual(applyMove(backgammon, state, 1, null), { error: 'Unknown move type' });
  assert.deepEqual(applyMove(backgammon, state, 1, 'move'), { error: 'Unknown move type' });
  assert.deepEqual(applyMove(backgammon, state, 1, { type: 'roll' }), { error: 'Unknown move type' });
});
