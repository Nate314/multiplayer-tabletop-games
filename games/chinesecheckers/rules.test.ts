import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chinesecheckers } from './index.ts';
import { HOLES, POINT_HOLES, holeKey, pointOf } from './board.ts';
import {
  finalStandings, hasWon, isLegalPath, marblesHome, moveSummary, nextLandings, onPlayerLeft, toPublicState
} from './rules.ts';
import { addPlayer, applyMove as platformMove, removePlayer } from '../../shared/seating.ts';
import type { GameState, Hole, PointIndex, Result, Seat } from './types.ts';

const NAMES = ['Alice', 'Bob', 'Cara', 'Dan', 'Eve', 'Fay'];
const random = () => 0.5;

type Marble = [number, number, Seat];

function lobby(count: number): GameState {
  let state = chinesecheckers.createGameState('g1');
  for (const name of NAMES.slice(0, count)) {
    const result = addPlayer(chinesecheckers, state, name, random);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

// A seated game with only the given marbles on the board, `current` to move
function board(count: number, marbles: Marble[], current: Seat = 1): GameState {
  return {
    ...lobby(count),
    started: true,
    currentPlayer: current,
    holes: Object.fromEntries(marbles.map(([q, r, seat]) => [holeKey({ q, r }), seat]))
  };
}

const at = (...coords: [number, number][]): Hole[] => coords.map(([q, r]) => ({ q, r }));

// The first `n` holes of a point, each holding one of `seat`'s marbles
const inPoint = (point: PointIndex, seat: Seat, n = 10): Marble[] =>
  POINT_HOLES[point].slice(0, n).map(({ q, r }) => [q, r, seat]);

function play(state: GameState, seat: Seat, path: unknown): Result<GameState> {
  return chinesecheckers.applyMove(state, seat, { type: 'move', path }, random, 0);
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const keys = (holes: Hole[]) => holes.map(holeKey).sort();
// A marble of Bob's out of the way, so Bob always has a move
const BOB_AWAY: Marble = [0, -3, 2];

test('2 players start opposite', () => {
  const state = lobby(2);
  assert.deepEqual(state.points, { 1: 0, 2: 3 });
  assert.equal(Object.keys(state.holes).length, 20);
  assert.ok(POINT_HOLES[0].every(hole => state.holes[holeKey(hole)] === 1));
  assert.ok(POINT_HOLES[3].every(hole => state.holes[holeKey(hole)] === 2));
});

test('3 players start on alternating points', () => {
  assert.deepEqual(lobby(3).points, { 1: 0, 2: 2, 3: 4 });
});

test('4 players use two opposite pairs', () => {
  assert.deepEqual(lobby(4).points, { 1: 0, 2: 1, 3: 3, 4: 4 });
});

test('6 players fill every point', () => {
  const state = lobby(6);
  assert.deepEqual(state.points, { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 });
  assert.equal(Object.keys(state.holes).length, 60);
});

test('five players cannot start', () => {
  const state = lobby(5);
  assert.equal(state.gameStatus, 'Chinese Checkers needs 2, 3, 4 or 6 players');
  assert.deepEqual(state.points, {});
  assert.deepEqual(state.holes, {});
  assert.deepEqual(play(state, 1, at([-4, 5], [-4, 4])), { error: 'Chinese Checkers needs 2, 3, 4 or 6 players' });
});

test('a marble steps to an adjacent empty hole', () => {
  const next = ok(play(board(2, [[0, 0, 1], BOB_AWAY]), 1, at([0, 0], [1, 0])));
  assert.equal(next.holes['1,0'], 1);
  assert.equal(next.holes['0,0'], undefined);
  assert.deepEqual(next.lastMove, { playerNumber: 1, path: at([0, 0], [1, 0]) });
  assert.equal(next.gameStatus, 'Alice moved a marble');
});

test('a marble cannot step onto a marble or off the board', () => {
  const state = board(2, [[0, 0, 1], [1, 0, 2], [4, -8, 1]]);
  assert.deepEqual(play(state, 1, at([0, 0], [1, 0])), { error: 'Invalid move' });
  assert.deepEqual(play(state, 1, at([4, -8], [4, -9])), { error: 'Invalid move' });
  assert.deepEqual(play(state, 1, at([0, 0], [2, -2])), { error: 'Invalid move' }); // not adjacent
});

test('a hop goes over one adjacent marble of any color into the empty hole beyond', () => {
  const state = board(2, [[0, 0, 1], [1, 0, 2], [0, 1, 1], BOB_AWAY]);
  const overBob = ok(play(state, 1, at([0, 0], [2, 0])));
  assert.equal(overBob.holes['2,0'], 1);
  assert.equal(overBob.gameStatus, 'Alice made 1 jump');
  assert.equal(ok(play(state, 1, at([0, 0], [0, 2]))).holes['0,2'], 1);
});

test('a hop over two marbles in a row or over a gap is refused', () => {
  const inRow = board(2, [[0, 0, 1], [1, 0, 2], [2, 0, 2]]);
  assert.deepEqual(play(inRow, 1, at([0, 0], [3, 0])), { error: 'Invalid move' });
  const gap = board(2, [[0, 0, 1], [2, 0, 2]]);
  assert.deepEqual(play(gap, 1, at([0, 0], [4, 0])), { error: 'Invalid move' });
  assert.deepEqual(play(gap, 1, at([0, 0], [2, 0])), { error: 'Invalid move' });
});

test('a chain of hops may stop at any landing', () => {
  const state = board(2, [[0, 0, 1], [1, 0, 2], [2, -1, 2], [2, -3, 1], BOB_AWAY]);
  const chain = at([0, 0], [2, 0], [2, -2], [2, -4]);
  for (const length of [2, 3, 4]) assert.ok(isLegalPath(state, 1, chain.slice(0, length)), `length ${length}`);
  const next = ok(play(state, 1, chain));
  assert.equal(next.holes['2,-4'], 1);
  assert.equal(next.gameStatus, 'Alice made 3 jumps');
});

test('a step cannot follow or precede a hop', () => {
  const stepFirst = board(2, [[0, 0, 1], [2, 0, 2]]);
  assert.deepEqual(play(stepFirst, 1, at([0, 0], [1, 0], [3, 0])), { error: 'Invalid move' });
  assert.deepEqual(nextLandings(stepFirst, at([0, 0], [1, 0])), []);
  const hopFirst = board(2, [[0, 0, 1], [1, 0, 2]]);
  assert.deepEqual(play(hopFirst, 1, at([0, 0], [2, 0], [3, 0])), { error: 'Invalid move' });
});

test('a chain may not land twice on one hole or end where it began', () => {
  const state = board(2, [[0, 0, 1], [1, 0, 2], [2, -1, 2]]);
  assert.equal(isLegalPath(state, 1, at([0, 0], [2, 0], [2, -2], [2, 0])), false);
  assert.equal(isLegalPath(state, 1, at([0, 0], [2, 0], [0, 0])), false);
  assert.deepEqual(nextLandings(state, at([0, 0], [2, 0], [2, -2])), []);
});

test('a chain may hop through the hole the marble left', () => {
  // The marble's own hole is empty while it moves, so a chain circles all the way round it
  // and Bob's marble at 0,1 still offers no hop back into it
  const state = board(2, [
    [0, 0, 1], [1, 0, 2], [2, -1, 2], [1, -2, 2], [-1, -1, 2], [-2, 1, 2], [-1, 2, 2], [0, 1, 2]
  ]);
  const loop = at([0, 0], [2, 0], [2, -2], [0, -2], [-2, 0], [-2, 2], [0, 2]);
  assert.ok(isLegalPath(state, 1, loop));
  assert.ok(!keys(nextLandings(state, loop)).includes('0,0'));
  assert.equal(isLegalPath(state, 1, [...loop, { q: 0, r: 0 }]), false);
});

test('no marble is captured', () => {
  const state = board(2, [[0, 0, 1], [1, 0, 2], BOB_AWAY]);
  const next = ok(play(state, 1, at([0, 0], [2, 0])));
  assert.equal(Object.keys(next.holes).length, 3);
  assert.equal(next.holes['1,0'], 2);
});

test('only the current player moves, and only their own marble', () => {
  const state = board(2, [[0, 0, 1], [1, 1, 2], BOB_AWAY]);
  assert.deepEqual(platformMove(chinesecheckers, state, 2, { type: 'move', path: at([1, 1], [2, 1]) }, random, 0),
    { error: 'Not your turn' });
  assert.deepEqual(play(state, 1, at([1, 1], [2, 1])), { error: 'Invalid move' });
  assert.deepEqual(play(state, 1, 'nonsense'), { error: 'Invalid move' });
  assert.deepEqual(play(state, 1, [{ q: 0, r: 0 }, { q: 'x', r: 0 }]), { error: 'Invalid move' });
});

test('turns go to the next seated player', () => {
  const state = { ...lobby(3), started: true };
  assert.equal(state.currentPlayer, 1);
  const next = ok(play(state, 1, at([-4, 5], [-4, 4])));
  assert.equal(next.currentPlayer, 2);
  assert.equal(ok(play(next, 2, at([-1, -4], [0, -4]))).currentPlayer, 3);
});

test('a player with no move passes', () => {
  // Bob's one marble is in the tip of his point, boxed in by Cara's marbles
  const state = board(3, [[0, 0, 1], [-4, -4, 2], [-3, -4, 3], [-4, -3, 3], [-2, -4, 3], [-4, -2, 3]]);
  const next = ok(play(state, 1, at([0, 0], [1, 0])));
  assert.equal(next.currentPlayer, 3);
  assert.equal(next.gameStatus, 'Alice moved a marble. Bob has no move and passes');
});

test('when nobody can move the game ends with the most marbles home winning', () => {
  // Every move can be played back, so this only happens when a leaver takes the last movable marbles
  const state = board(3, [[0, 0, 2]], 2);
  const next = onPlayerLeft({ ...state, activePlayers: [1, 3] }, 2);
  assert.equal(next.isGameOver, true);
  assert.equal(next.currentPlayer, null);
  assert.deepEqual(next.winners, [1, 3]);
  assert.equal(next.gameStatus, 'Nobody can move. Alice and Cara win with the most marbles home');
});

test('when nobody can move and one player has the most marbles home, that player wins', () => {
  // Every hole is taken, so when Bob leaves on his turn nobody can move. Alice has two marbles home, Cara none
  const owner = (hole: Hole): Seat => {
    if (pointOf(hole) === 1) return 1;
    return POINT_HOLES[3].slice(0, 2).some(home => holeKey(home) === holeKey(hole)) ? 1 : 3;
  };
  const state = board(3, HOLES.map((hole): Marble => [hole.q, hole.r, owner(hole)]), 2);
  const next = onPlayerLeft({ ...state, activePlayers: [1, 3] }, 2);
  assert.equal(next.isGameOver, true);
  assert.deepEqual(next.winners, [1]);
  assert.equal(next.gameStatus, 'Nobody can move. Alice wins with the most marbles home');
});

test('filling the opposite point wins and ends the game', () => {
  const rest = inPoint(3, 1).filter(([q, r]) => !(q === 1 && r === -5));
  const next = ok(play(board(2, [...rest, [1, -4, 1], [0, 4, 2]]), 1, at([1, -4], [1, -5])));
  assert.equal(next.isGameOver, true);
  assert.deepEqual(next.winners, [1]);
  assert.equal(next.currentPlayer, null);
  assert.equal(next.gameStatus, 'Alice filled the far point and wins!');
  assert.equal(moveSummary('Alice', next.lastMove!, true), 'Alice moved a marble and won');
});

test('an opponent marble left in the target still lets the player win', () => {
  const [[q, r], ...rest] = inPoint(3, 1);
  const state = board(2, [...rest, [q, r, 2]]);
  assert.equal(marblesHome(state, 1), 9);
  assert.equal(hasWon(state, 1), true);
});

test('a target full of opponent marbles is not a win', () => {
  const state = lobby(2);
  assert.equal(hasWon(state, 1), false);
  assert.equal(hasWon(state, 2), false);
});

test('a full target with only four own marbles is not a win', () => {
  const state = board(2, [...inPoint(3, 2, 6), ...POINT_HOLES[3].slice(6).map(({ q, r }): Marble => [q, r, 1])]);
  assert.equal(marblesHome(state, 1), 4);
  assert.equal(hasWon(state, 1), false);
});

test('a target holding ten own marbles is a win', () => {
  assert.equal(hasWon(board(2, inPoint(3, 1)), 1), true);
});

test("a move that completes another seat's target makes that seat the winner", () => {
  // Bob has nine marbles in point 0, his target; Alice steps into its last hole
  const bobs = inPoint(0, 2).filter(([q, r]) => !(q === -1 && r === 5));
  const next = ok(play(board(2, [...bobs, [-1, 4, 1], BOB_AWAY]), 1, at([-1, 4], [-1, 5])));
  assert.equal(next.isGameOver, true);
  assert.deepEqual(next.winners, [2]);
  assert.equal(next.currentPlayer, null);
  assert.equal(next.gameStatus, 'Bob filled the far point and wins!');
});

test('the others are ranked by marbles home', () => {
  // Alice's target is point 3, Bob's point 5, Cara's point 1
  const state = { ...board(3, [...inPoint(3, 1), ...inPoint(5, 2, 1), ...inPoint(1, 3, 3)]), isGameOver: true, winners: [1] };
  assert.deepEqual(finalStandings(state), [
    { seat: 1, place: 1, score: '10 of 10 marbles home' },
    { seat: 3, place: 2, score: '3 of 10 marbles home' },
    { seat: 2, place: 3, score: '1 of 10 marbles home' }
  ]);
});

test('a dismissed player loses their marbles and play goes on', () => {
  const state = { ...lobby(3), started: true, currentPlayer: 2 };
  const next = removePlayer(chinesecheckers, state, 2);
  assert.ok(Object.values(next.holes).every(owner => owner !== 2));
  assert.equal(next.points[2], undefined);
  assert.equal(next.currentPlayer, 3);
  assert.equal(next.isGameOver, false);
  assert.equal(Object.keys(next.holes).length, 20);
  // Called on its own while the leaver held the turn, the hook moves it on too
  assert.equal(onPlayerLeft({ ...state, activePlayers: [1, 3] }, 2).currentPlayer, 3);
});

test('the public view is the whole state with undoAvailable', () => {
  const state = lobby(2);
  assert.deepEqual(toPublicState(state, true), { ...state, undoAvailable: true });
});
