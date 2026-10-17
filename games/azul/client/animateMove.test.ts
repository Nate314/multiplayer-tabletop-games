import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slides } from './animateMove.ts';
import { applyMove } from '../rules.ts';
import type { Color, GameState, Move, PatternLine, PlayerBoard, Result } from '../types.ts';

function board(overrides: Partial<PlayerBoard> = {}): PlayerBoard {
  const patternLines: PatternLine[] = Array.from({ length: 5 }, () => ({ color: null, count: 0 }));
  const wall = Array.from({ length: 5 }, () => Array<boolean>(5).fill(false));
  return { patternLines, wall, floor: [], score: 0, ...overrides };
}

// A two-player game under way with Alice (seat 1) to move
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: 'g',
    started: true,
    round: 1,
    currentPlayer: 1,
    activePlayers: [1, 2],
    playerNames: { 1: 'Alice', 2: 'Bob' },
    factories: [[], [], [], [], []],
    center: [],
    centerHasMarker: false,
    boards: { 1: board(), 2: board() },
    lastMove: null,
    gameStatus: '',
    isGameOver: false,
    winners: [],
    roundSummary: null,
    undoVote: null,
    disconnected: [],
    dismissVote: null,
    bag: [],
    lid: [],
    roundStarter: 1,
    markerHolder: null,
    ...overrides
  };
}

function after(state: GameState, move: Move, seat = 1): GameState {
  const result: Result<GameState> = applyMove(state, seat, move);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const factory = (index: number) => ({ type: 'factory', index }) as const;
const CENTER = { type: 'center' } as const;
const lines = (filled: Record<number, PatternLine>): PatternLine[] =>
  Array.from({ length: 5 }, (_, row) => filled[row] ?? { color: null, count: 0 });

test('picked tiles fill the line from the right and the rest of the factory joins the center', () => {
  const before = game({
    factories: [['red', 'blue', 'red', 'cyan'], ['black'], [], [], []],
    center: ['red', 'cyan'],
    boards: { 1: board({ patternLines: lines({ 2: { color: 'red', count: 1 } }) }), 2: board() }
  });
  // Factory 0 shows blue, red, red, cyan; the center shows red, cyan and becomes blue, red, cyan, cyan
  assert.deepEqual(slides(before, after(before, { source: factory(0), color: 'red', line: 2 })), [
    ['factory-0-1', 'line-1-2-1'],
    ['factory-0-2', 'line-1-2-0'],
    ['factory-0-0', 'center-0'],
    ['factory-0-3', 'center-3']
  ]);
});

test('tiles that do not fit go to the floor after the first-player marker', () => {
  const before = game({
    factories: [['black'], [], [], [], []],
    center: ['yellow', 'blue', 'yellow', 'yellow'],
    centerHasMarker: true,
    boards: { 1: board({ floor: ['red'] }), 2: board() }
  });
  // The center shows blue, yellow, yellow, yellow; line 1 holds two
  assert.deepEqual(slides(before, after(before, { source: CENTER, color: 'yellow', line: 1 })), [
    ['center-1', 'line-1-1-1'],
    ['center-2', 'line-1-1-0'],
    ['center-marker', 'floor-1-1'],
    ['center-3', 'floor-1-2']
  ]);
});

test('only the floor slots there are room for animate', () => {
  const full: Color[] = ['red', 'red', 'red', 'red', 'red', 'red'];
  const before = game({
    factories: [['blue', 'blue', 'black', 'black'], ['black'], [], [], []],
    boards: { 1: board({ floor: full }), 2: board() }
  });
  assert.deepEqual(slides(before, after(before, { source: factory(0), color: 'blue', line: 'floor' })), [
    ['factory-0-0', 'floor-1-6'],
    ['factory-0-2', 'center-0'],
    ['factory-0-3', 'center-1']
  ]);
});

test('leftovers of one color from a factory join the end of that color in the center', () => {
  const before = game({
    currentPlayer: 2,
    factories: [['black', 'red', 'black', 'blue'], ['cyan'], [], [], []],
    center: ['black', 'yellow']
  });
  // Factory 0 shows blue, red, black, black; the center becomes yellow, red, black, black, black
  assert.deepEqual(slides(before, after(before, { source: factory(0), color: 'blue', line: 0 }, 2)), [
    ['factory-0-0', 'line-2-0-0'],
    ['factory-0-1', 'center-1'],
    ['factory-0-2', 'center-3'],
    ['factory-0-3', 'center-4']
  ]);
});

test('a round-ending move slides each new wall tile from the last slot of its line', () => {
  const before = game({
    factories: [['red', 'red'], [], [], [], []],
    boards: {
      1: board({ patternLines: lines({ 0: { color: 'blue', count: 1 }, 2: { color: 'black', count: 2 } }) }),
      2: board({ patternLines: lines({ 1: { color: 'cyan', count: 2 } }) })
    }
  });
  const next = after(before, { source: factory(0), color: 'red', line: 1 });
  assert.ok(next.roundSummary, 'the round ended');
  // Line 1 filled and went straight to the wall, so its wall tile comes from the factory
  assert.deepEqual(slides(before, next), [
    ['line-1-0-0', 'wall-1-0-0'],
    ['factory-0-0', 'wall-1-1-3'],
    ['line-2-1-1', 'wall-2-1-0']
  ]);
});

test('a round-ending move that leaves its line partial fills the line and skips the floor', () => {
  const before = game({
    center: ['yellow', 'yellow', 'yellow'],
    centerHasMarker: true,
    boards: { 1: board({ patternLines: lines({ 4: { color: 'yellow', count: 1 } }) }), 2: board() }
  });
  const next = after(before, { source: CENTER, color: 'yellow', line: 4 });
  assert.ok(next.roundSummary, 'the round ended');
  // Line 5 now holds 4 of 5 and stays; the marker went to the floor, which scoring cleared
  assert.deepEqual(slides(before, next), [
    ['center-0', 'line-1-4-3'],
    ['center-1', 'line-1-4-2'],
    ['center-2', 'line-1-4-1']
  ]);
});

test('nothing slides without a last move', () => {
  assert.deepEqual(slides(game(), game()), []);
});
