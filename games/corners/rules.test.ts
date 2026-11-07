import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMove as applyRules, cellsOf, colorScore, createGameState, finalStandings, legalSpots, onPlayerLeft,
  placementError, resetLobby, seatToPlace, toPublicState
} from './rules.ts';
import { cornersInfo } from './info.ts';
import { PIECES, TRIANGLE_STARTS, orientations, type Cell } from './geometry.ts';
import { withRules } from '../../server/testing.ts';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import type { GameDefinition } from '../../shared/gameDefinition.ts';
import { seeded, NAMES } from '../testStates.ts';
import type { Color, GameState, Move, PublicGameState } from './types.ts';

// Task 4 builds the real definition; these tests need only what the seating helpers call
const game = {
  info: cornersInfo, createGameState, resetLobby, applyMove: applyRules, onPlayerLeft, toPublicState
} as unknown as GameDefinition<GameState, PublicGameState>;

function lobby(seats: number, board?: 'squares' | 'triangles'): GameState {
  let state: GameState = createGameState('g');
  if (board) state = { ...state, houseRules: withRules({ board }) };
  for (const name of NAMES.slice(0, seats)) {
    const result = addPlayer(game, state, name, seeded(1));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

function play(state: GameState, move: Move): GameState {
  const result = applyMove(game, state, state.currentPlayer as number, move);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const single = (dx: number, dy: number): Move => ({ type: 'place', piece: 0, orientation: 0, dx, dy });

// Places the first unplayed piece, in the first orientation, that has a legal spot
function playAny(state: GameState): GameState {
  const color = state.turnColor;
  for (let piece = PIECES[state.board].length - 1; piece >= 0; piece--) {
    if (state.used[color].includes(piece)) continue;
    const count = orientations(state.board, PIECES[state.board][piece]).length;
    for (let orientation = 0; orientation < count; orientation++) {
      const [spot] = legalSpots(state, color, piece, orientation);
      if (spot) return play(state, { type: 'place', piece, orientation, ...spot });
    }
  }
  assert.fail('no legal placement');
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const ALL_BUT_SINGLE = range(21).slice(1);

test('two players own two colors each and alternate', () => {
  let state = lobby(2);
  assert.deepEqual(state.owners, { 0: 1, 1: 2, 2: 1, 3: 2 });
  const turns: (number | null)[] = [];
  for (const [x, y] of [[0, 0], [19, 0], [19, 19], [0, 19]]) {
    turns.push(state.currentPlayer);
    state = play(state, single(x, y));
  }
  assert.deepEqual(turns, [1, 2, 1, 2]);
  assert.equal(state.gameStatus, 'Bob placed a piece in Green');
});

test('three players share the fourth color in turn', () => {
  let state = lobby(3);
  assert.deepEqual(state.owners, { 0: 1, 1: 2, 2: 3, 3: 'shared' });
  const sharedBy: (number | null)[] = [];
  while (sharedBy.length < 3) {
    if (state.turnColor === 3) sharedBy.push(state.currentPlayer);
    state = playAny(state);
    const { scores } = toPublicState(state, false);
    assert.deepEqual(Object.keys(scores), ['1', '2', '3']);
    assert.equal(scores[1], colorScore(state, 0));
  }
  assert.deepEqual(sharedBy, [1, 2, 3]);
});

test('the first piece must cover the corner on squares', () => {
  const state = lobby(2);
  assert.deepEqual(applyRules(state, 1, single(1, 0)), { error: 'Your first piece must cover your corner' });
  assert.deepEqual(play(state, single(0, 0)).placed, [{ color: 0, piece: 0, cells: [[0, 0, 0]] }]);
});

test('the first piece must cover a starting point on triangles', () => {
  const state = lobby(2, 'triangles');
  const start = TRIANGLE_STARTS[3];
  const orientation = orientations('triangles', PIECES.triangles[0]).findIndex(([c]) => c[2] === start[2]);
  const move = (dx: number, dy: number): Move => ({ type: 'place', piece: 0, orientation, dx, dy });
  assert.deepEqual(applyRules(state, 1, move(0, 0)), { error: 'Your first piece must cover a starting point' });
  assert.deepEqual(play(state, move(start[0], start[1])).placed[0].cells, [start]);
});

test('a later piece must touch its color at a corner and never along a side', () => {
  const state = play(lobby(2), single(0, 0));
  const blue = { ...state, turnColor: 0 as Color };
  assert.equal(placementError(blue, 0, [[1, 0, 0], [2, 0, 0]]), 'Pieces of one color may only touch at corners');
  assert.equal(placementError(blue, 0, [[2, 2, 0], [2, 3, 0]]), 'A piece must touch your color at a corner');
  assert.equal(placementError(blue, 0, [[1, 1, 0], [1, 2, 0]]), null);
  const touchingYellow = { ...blue, placed: [...blue.placed, { color: 1 as Color, piece: 0, cells: [[2, 1, 0] as Cell] }] };
  assert.equal(placementError(touchingYellow, 0, [[1, 1, 0], [1, 2, 0]]), null);
  assert.equal(placementError(blue, 0, [[0, 0, 0]]), 'That space is taken');
  assert.equal(placementError(blue, 0, [[20, 0, 0]]), 'That spot is not on the board');
});

test('a corner on a side is a corner touch on triangles', () => {
  // A three-triangle piece whose bottom side runs straight from (0,0) to (2,0); an upward triangle's tip meets its middle
  const trapezoid: Cell[] = [[0, 0, 0], [0, 0, 1], [1, 0, 0]];
  const base = lobby(2, 'triangles');
  const state: GameState = { ...base, placed: [{ color: 0, piece: 2, cells: trapezoid }], used: { ...base.used, 0: [2] } };
  assert.equal(placementError(state, 0, [[1, -1, 0]]), null);
  assert.equal(placementError(state, 0, [[0, -1, 1]]), 'Pieces of one color may only touch at corners');
});

test('forged moves are refused', () => {
  let state = lobby(2);
  for (const [x, y] of [[0, 0], [19, 0], [19, 19], [0, 19]]) state = play(state, single(x, y));
  const before = structuredClone(state);
  const forged: [unknown, string][] = [
    [{ type: 'place', piece: 1, orientation: 99, dx: 1, dy: 1 }, 'Invalid move'],
    [{ type: 'place', piece: 1, orientation: 0, dx: 1.5, dy: 1 }, 'Invalid move'],
    [{ type: 'place', piece: 1, orientation: 0, dx: 1e9, dy: 1 }, 'That spot is not on the board'],
    [{ type: 'place', piece: 0, orientation: 0, dx: 1, dy: 1 }, 'That piece is already played'],
    [{ type: 'place', piece: -1, orientation: 0, dx: 1, dy: 1 }, 'Invalid move'],
    [{ type: 'place', piece: '1', orientation: 0, dx: 1, dy: 1 }, 'Invalid move'],
    [{ type: 'jump' }, 'Unknown move type'],
    [null, 'Unknown move type']
  ];
  for (const [move, error] of forged) assert.deepEqual(applyRules(state, 1, move), { error }, JSON.stringify(move));
  assert.deepEqual(state, before);
});

test('a blocked color is skipped and stays out', () => {
  const base = lobby(2);
  // Red already covers Yellow's corner, so Yellow has nowhere to start
  let state: GameState = { ...base, placed: [{ color: 2, piece: 0, cells: [[19, 0, 0]] }], used: { ...base.used, 2: [0] } };
  state = play(state, single(0, 0));
  assert.equal(state.turnColor, 2);
  assert.equal(state.currentPlayer, 1);
  assert.deepEqual(state.out, [1]);
  assert.match(state.gameStatus, /Alice placed a piece in Blue\. Yellow cannot place any more/);
  state = playAny(playAny(state)); // Red, then Green
  assert.equal(state.turnColor, 0);
  state = playAny(state);
  assert.equal(state.turnColor, 2);
  assert.deepEqual(state.out, [1]);
  assert.doesNotMatch(state.gameStatus, /Yellow/);
});

test('the move that blocks everyone ends the game', () => {
  const base = lobby(2);
  // Yellow has only its single square left and one empty cell at its corner; Blue fills that cell with its last piece
  const state: GameState = {
    ...base,
    placed: [{ color: 1, piece: 1, cells: [[19, 0, 0]] }, { color: 0, piece: 1, cells: [[17, 2, 0]] }],
    used: { 0: ALL_BUT_SINGLE, 1: ALL_BUT_SINGLE, 2: [], 3: [] },
    out: [2, 3]
  };
  const over = play(state, single(18, 1));
  assert.equal(over.isGameOver, true);
  assert.equal(over.currentPlayer, null);
  assert.deepEqual(over.out, [2, 3, 1, 0]);
  assert.deepEqual(over.winners, [1]);
  assert.equal(over.gameStatus, 'Alice wins with -69 points');
  assert.deepEqual(toPublicState(over, false).scores, { 1: -69, 2: -90 });
  assert.deepEqual(finalStandings(over), [{ seat: 1, place: 1, score: '-69 points' }, { seat: 2, place: 2, score: '-90 points' }]);
});

test('scoring: minus unplayed cells, plus 15 for all, plus 5 when the single cell is last', () => {
  const base = lobby(2);
  const withUsed = (used: number[]) => ({ ...base, used: { ...base.used, 0: used } });
  assert.equal(colorScore(withUsed([...ALL_BUT_SINGLE, 0]), 0), 20);
  assert.equal(colorScore(withUsed(range(21)), 0), 15);
  assert.equal(PIECES.squares[20].length, 5);
  assert.equal(colorScore(withUsed([20]), 0), -84);
  assert.equal(colorScore(base, 0), -89);
});

test('two players score both their colors; a tie is a shared win', () => {
  const base = lobby(2);
  const done = [...ALL_BUT_SINGLE, 0];
  const state: GameState = {
    ...base,
    placed: [{ color: 0, piece: 1, cells: [[0, 0, 0]] }],
    used: { 0: ALL_BUT_SINGLE, 1: done, 2: done, 3: done },
    out: [1, 2, 3]
  };
  const over = play(state, single(1, 1));
  assert.deepEqual(toPublicState(over, false).scores, { 1: 40, 2: 40 });
  assert.deepEqual(toPublicState(over, false).colorScores, { 0: 20, 1: 20, 2: 20, 3: 20 });
  assert.deepEqual(over.winners, [1, 2]);
  assert.equal(over.gameStatus, 'Alice and Bob tie with 40 points');
});

test("a dismissed player's colors go out and the shared color keeps rotating", () => {
  let state = playAny(lobby(3)); // Blue
  assert.equal(state.currentPlayer, 2);
  state = removePlayer(game, state, 2);
  assert.deepEqual(state.out, [1]);
  assert.equal(state.turnColor, 2);
  assert.equal(state.currentPlayer, 3);
  const sharedBy: (number | null)[] = [];
  while (sharedBy.length < 2) {
    if (state.turnColor === 3) sharedBy.push(seatToPlace(state));
    state = playAny(state);
  }
  assert.deepEqual(sharedBy, [1, 3]);
  assert.deepEqual(state.out, [1]);
});

test('changing the Board rule resets the board', () => {
  const played = play(lobby(2), single(0, 0));
  const state = resetLobby({ ...played, houseRules: withRules({ board: 'triangles' }) });
  assert.equal(state.board, 'triangles');
  assert.deepEqual(state.placed, []);
  assert.deepEqual(state.used, { 0: [], 1: [], 2: [], 3: [] });
  assert.equal(lobby(2, 'triangles').board, 'triangles');
});

test('standings rank by score with winners first', () => {
  const base = lobby(3);
  const state: GameState = {
    ...base, isGameOver: true, winners: [2],
    used: { 0: [20], 1: range(21), 2: [], 3: range(21) }
  };
  assert.deepEqual(finalStandings(state), [
    { seat: 2, place: 1, score: '15 points' },
    { seat: 1, place: 2, score: '-84 points' },
    { seat: 3, place: 3, score: '-89 points' }
  ]);
});

test('legal spots are distinct and each one places', () => {
  const state = play(lobby(2), single(0, 0));
  const blue = { ...state, turnColor: 0 as Color };
  const spots = legalSpots(blue, 0, 1, 0);
  assert.ok(spots.length > 0);
  assert.equal(new Set(spots.map(s => `${s.dx},${s.dy}`)).size, spots.length);
  for (const { dx, dy } of spots) assert.equal(placementError(blue, 0, cellsOf(blue, 1, 0, dx, dy)), null);
});

test('a whole game on either board plays to the end with a placeable color always on turn', () => {
  for (const board of ['squares', 'triangles'] as const) {
    let state = lobby(4, board);
    while (!state.isGameOver) {
      assert.equal(state.out.includes(state.turnColor), false);
      state = playAny(state);
    }
    assert.equal(state.out.length, 4);
    assert.ok(state.winners.length > 0);
  }
});
