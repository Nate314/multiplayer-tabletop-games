import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLORS,
  factoryCount,
  wallColor,
  wallColumn,
  canPlaceOnLine,
  legalLines,
  sourceColors,
  scorePlacement,
  floorPenalty,
  completeRows,
  endGameBonus,
  toPublicState,
  acknowledgeRound,
  createGameState
} from './rules.ts';
import { azul } from './index.ts';
import { addPlayer, removePlayer, applyMove } from '../../shared/seating.ts';
import type { Color, GameState, Move, PatternLine, PlayerBoard, Result, Source } from './types.ts';

function wallOf(...cells: [number, number][]): boolean[][] {
  const wall = Array.from({ length: 5 }, () => Array<boolean>(5).fill(false));
  for (const [row, col] of cells) wall[row][col] = true;
  return wall;
}

function linesOf(lines: Record<number, PatternLine> = {}): PatternLine[] {
  return Array.from({ length: 5 }, (_, row) => lines[row] ?? { color: null, count: 0 });
}

function board(overrides: Partial<PlayerBoard> = {}): PlayerBoard {
  return { patternLines: linesOf(), wall: wallOf(), floor: [], score: 0, ...overrides };
}

const fullRow = (row: number): [number, number][] => [0, 1, 2, 3, 4].map(col => [row, col]);
const fullColumn = (col: number): [number, number][] => [0, 1, 2, 3, 4].map(row => [row, col]);

test('factory count depends on player count', () => {
  assert.equal(factoryCount(2), 5);
  assert.equal(factoryCount(3), 7);
  assert.equal(factoryCount(4), 9);
});

test('the wall shifts the colors one step per row', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(col => wallColor(0, col)), ['blue', 'yellow', 'red', 'black', 'cyan']);
  assert.deepEqual([0, 1, 2, 3, 4].map(col => wallColor(1, col)), ['cyan', 'blue', 'yellow', 'red', 'black']);
  assert.equal(wallColor(4, 0), 'yellow');
  for (let col = 0; col < 5; col++) {
    assert.equal(new Set([0, 1, 2, 3, 4].map(row => wallColor(row, col))).size, 5);
  }
});

test('wallColumn finds the space for a color in a row', () => {
  for (let row = 0; row < 5; row++) {
    for (const color of COLORS) assert.equal(wallColor(row, wallColumn(row, color)), color);
  }
});

test('an empty board takes any color on any line', () => {
  assert.deepEqual(legalLines(board(), 'red'), [0, 1, 2, 3, 4]);
});

test('a line holds one color and stops when full', () => {
  const b = board({ patternLines: linesOf({ 0: { color: 'red', count: 1 }, 2: { color: 'blue', count: 1 } }) });
  assert.deepEqual(legalLines(b, 'red'), [1, 3, 4]);
  assert.deepEqual(legalLines(b, 'blue'), [1, 2, 3, 4]);
});

test('a line refuses a color already on the wall in that row', () => {
  const b = board({ wall: wallOf([1, wallColumn(1, 'red')]) });
  assert.equal(canPlaceOnLine(b, 1, 'red'), false);
  assert.equal(canPlaceOnLine(b, 1, 'blue'), true);
  assert.equal(canPlaceOnLine(b, 2, 'red'), true);
});

test('lines off the board are never legal', () => {
  assert.equal(canPlaceOnLine(board(), 5, 'red'), false);
  assert.equal(canPlaceOnLine(board(), -1, 'red'), false);
});

test('sourceColors lists each color in a source once', () => {
  const table = { factories: [['red', 'blue', 'red', 'red'] as const].map(tiles => [...tiles]), center: [] };
  assert.deepEqual(sourceColors(table, { type: 'factory', index: 0 }), ['blue', 'red']);
  assert.deepEqual(sourceColors(table, { type: 'factory', index: 7 }), []);
  assert.deepEqual(sourceColors(table, { type: 'center' }), []);
});

test('a tile alone scores 1', () => {
  assert.equal(scorePlacement(wallOf([2, 2]), 2, 2), 1);
  assert.equal(scorePlacement(wallOf([0, 0], [0, 2]), 0, 2), 1); // a gap breaks the run
});

test('a tile scores the length of its row or column run', () => {
  assert.equal(scorePlacement(wallOf([0, 0], [0, 1], [0, 2]), 0, 2), 3);
  assert.equal(scorePlacement(wallOf([0, 0], [1, 0]), 1, 0), 2);
  assert.equal(scorePlacement(wallOf([0, 0], [0, 1], [0, 2]), 0, 1), 3); // joins both sides
});

test('a tile in both a row run and a column run scores both', () => {
  assert.equal(scorePlacement(wallOf([2, 0], [2, 1], [2, 2], [1, 2]), 2, 2), 5);
});

test('floor penalties grow along the floor line', () => {
  assert.equal(floorPenalty([]), 0);
  assert.equal(floorPenalty(['first']), 1);
  assert.equal(floorPenalty(['red', 'red', 'blue']), 4);
  assert.equal(floorPenalty(['red', 'red', 'red', 'red', 'red', 'red', 'red']), 14);
});

test('end-game bonuses: 2 per row, 7 per column, 10 per color', () => {
  assert.equal(endGameBonus(wallOf()).points, 0);
  assert.deepEqual(endGameBonus(wallOf(...fullRow(0))), { rows: 1, columns: 0, colors: 0, points: 2 });
  assert.deepEqual(endGameBonus(wallOf(...fullColumn(0))), { rows: 0, columns: 1, colors: 0, points: 7 });
  assert.equal(endGameBonus(wallOf([0, 0], [1, 1], [2, 2], [3, 3], [4, 4])).points, 10); // every blue
  assert.deepEqual(endGameBonus(wallOf(...[0, 1, 2, 3, 4].flatMap(fullRow))), { rows: 5, columns: 5, colors: 5, points: 95 });
  assert.equal(completeRows(wallOf(...fullRow(0), ...fullRow(3), [1, 1])), 2);
});

function lobby(...names: string[]): GameState {
  let state = createGameState('g');
  for (const name of names) {
    const result = addPlayer(azul, state, name);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

// Every tile in play, wherever it is; the first-player marker is not a tile
function countTiles(state: GameState): number {
  const onBoards = Object.values(state.boards).reduce((sum, b) =>
    sum +
    b.patternLines.reduce((count, line) => count + line.count, 0) +
    b.wall.flat().filter(Boolean).length +
    b.floor.filter(item => item !== 'first').length, 0);
  return state.bag.length + state.lid.length + state.center.length + state.factories.flat().length + onBoards;
}

test('one player waits at an empty table', () => {
  const state = lobby('Alice');
  assert.deepEqual(state.activePlayers, [1]);
  assert.equal(state.currentPlayer, 1);
  assert.deepEqual(state.factories, []);
  assert.equal(state.centerHasMarker, false);
  assert.equal(state.started, false);
  assert.deepEqual(Object.keys(state.boards), ['1']);
});

test('the table is dealt for the number of players', () => {
  const two = lobby('Alice', 'Bob');
  assert.equal(two.factories.length, 5);
  assert.ok(two.factories.every(factory => factory.length === 4));
  assert.equal(two.bag.length, 80);
  assert.equal(two.centerHasMarker, true);
  assert.equal(two.currentPlayer, 1);
  assert.equal(two.roundStarter, 1);
  assert.equal(two.round, 1);
  assert.equal(two.gameStatus, 'Bob joined (2/4 players)');
  assert.equal(countTiles(two), 100);

  assert.equal(lobby('A', 'B', 'C').factories.length, 7);
  const four = lobby('A', 'B', 'C', 'D');
  assert.equal(four.factories.length, 9);
  assert.equal(four.bag.length, 64);
  for (const color of COLORS) {
    assert.equal([...four.bag, ...four.factories.flat()].filter(tile => tile === color).length, 20);
  }
});

test('a fifth player and a late player are refused', () => {
  assert.deepEqual(addPlayer(azul, lobby('A', 'B', 'C', 'D'), 'E'), { error: 'Game is full' });
  assert.deepEqual(addPlayer(azul, { ...lobby('A', 'B'), started: true }, 'C'), { error: 'Game already in progress' });
});

test('leaving the lobby frees the seat and deals afresh', () => {
  const state = removePlayer(azul, lobby('A', 'B', 'C'), 2);
  assert.deepEqual(state.activePlayers, [1, 3]);
  assert.deepEqual(state.playerNames, { 1: 'A', 3: 'C' });
  assert.deepEqual(Object.keys(state.boards), ['1', '3']);
  assert.equal(state.factories.length, 5);
  assert.equal(countTiles(state), 100);

  const rejoined = addPlayer(azul, state, 'D');
  if ('error' in rejoined) assert.fail(rejoined.error);
  assert.equal(rejoined.seat, 2);

  assert.deepEqual(removePlayer(azul, lobby('A', 'B'), 1).factories, []);
});

test('the public state has no bag, lid or bookkeeping', () => {
  const view = toPublicState(lobby('A', 'B'), true);
  assert.equal(view.undoAvailable, true);
  assert.equal('bag' in view, false);
  assert.equal('lid' in view, false);
  assert.equal('roundStarter' in view, false);
  assert.equal('markerHolder' in view, false);
  assert.equal(view.factories.length, 5);
});

// A two-player game already under way, with an empty table unless overridden
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
    centerHasMarker: true,
    boards: { 1: board(), 2: board() },
    lastMove: null,
    gameStatus: '',
    isGameOver: false,
    winners: [],
    roundSummary: null,
    undoVote: null,
    disconnected: [],
    dismissVote: null,
    bag: Array<Color>(40).fill('black'),
    lid: [],
    roundStarter: 1,
    markerHolder: null,
    ...overrides
  };
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const factory = (index: number): Source => ({ type: 'factory', index });
const CENTER: Source = { type: 'center' };
const take = (source: Source, color: Color, line: number | 'floor'): Move => ({ source, color, line });

// A table with tiles left over after the first pick, so the round does not end
const OPENING: Color[][] = [['blue', 'blue', 'red', 'yellow'], ['black', 'black', 'black', 'black'], [], [], []];

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('taking from a factory moves the rest to the center', () => {
  const next = ok(applyMove(azul, game({ factories: OPENING, started: false }), 1, take(factory(0), 'blue', 1)));
  assert.deepEqual(next.boards[1].patternLines[1], { color: 'blue', count: 2 });
  assert.deepEqual(next.boards[1].floor, []);
  assert.deepEqual(next.factories[0], []);
  assert.deepEqual(next.center, ['red', 'yellow']);
  assert.equal(next.centerHasMarker, true);
  assert.equal(next.currentPlayer, 2);
  assert.equal(next.started, true);
  assert.deepEqual(next.lastMove, { playerNumber: 1, source: factory(0), color: 'blue', count: 2, line: 1 });
  assert.equal(next.gameStatus, 'Alice took 2 blue from factory 1');
});

test('tiles that do not fit the line go to the floor', () => {
  const next = ok(applyMove(azul, game({ factories: OPENING }), 1, take(factory(0), 'blue', 0)));
  assert.deepEqual(next.boards[1].patternLines[0], { color: 'blue', count: 1 });
  assert.deepEqual(next.boards[1].floor, ['blue']);
});

test('the floor can be chosen outright', () => {
  const next = ok(applyMove(azul, game({ factories: OPENING }), 1, take(factory(0), 'blue', 'floor')));
  assert.deepEqual(next.boards[1].floor, ['blue', 'blue']);
  assert.ok(next.boards[1].patternLines.every(line => line.count === 0));
});

test('the first pick from the center takes the marker', () => {
  const state = game({ factories: OPENING, center: ['red', 'blue', 'red'] });
  const first = ok(applyMove(azul, state, 1, take(CENTER, 'red', 2)));
  assert.deepEqual(first.boards[1].floor, ['first']);
  assert.deepEqual(first.boards[1].patternLines[2], { color: 'red', count: 2 });
  assert.deepEqual(first.center, ['blue']);
  assert.equal(first.centerHasMarker, false);
  assert.equal(first.markerHolder, 1);
  assert.equal(first.gameStatus, 'Alice took 2 red from the center');

  const second = ok(applyMove(azul, first, 2, take(CENTER, 'blue', 0)));
  assert.deepEqual(second.boards[2].floor, []);
  assert.equal(second.markerHolder, 1);
});

test('tiles past the end of the floor line go to the lid', () => {
  const sixOnFloor = board({ floor: ['red', 'red', 'red', 'red', 'red', 'red'] });
  const state = game({ factories: OPENING, center: ['blue', 'blue', 'blue'], boards: { 1: sixOnFloor, 2: board() } });
  const next = ok(applyMove(azul, state, 1, take(CENTER, 'blue', 'floor')));
  assert.deepEqual(next.boards[1].floor, ['red', 'red', 'red', 'red', 'red', 'red', 'first']);
  assert.deepEqual(next.lid, ['blue', 'blue', 'blue']);
});

test('a marker that does not fit still makes its taker the next starter', () => {
  const fullFloor = board({ floor: ['red', 'red', 'red', 'red', 'red', 'red', 'red'] });
  const state = game({ factories: OPENING, center: ['blue'], boards: { 1: fullFloor, 2: board() } });
  const next = ok(applyMove(azul, state, 1, take(CENTER, 'blue', 'floor')));
  assert.equal(next.boards[1].floor.length, 7);
  assert.equal(next.boards[1].floor.includes('first'), false);
  assert.deepEqual(next.lid, ['blue']);
  assert.equal(next.markerHolder, 1);
  assert.equal(next.centerHasMarker, false);
});

test('illegal moves are refused', () => {
  const state = game({
    factories: OPENING,
    boards: { 1: board({ patternLines: linesOf({ 3: { color: 'red', count: 1 } }) }), 2: board() }
  });
  assert.deepEqual(applyMove(azul, state, 2, take(factory(0), 'blue', 1)), { error: 'Not your turn' });
  assert.deepEqual(applyMove(azul, state, 1, take(factory(0), 'cyan', 1)), { error: 'No tiles of that color there' });
  assert.deepEqual(applyMove(azul, state, 1, take(factory(2), 'blue', 1)), { error: 'No tiles of that color there' });
  assert.deepEqual(applyMove(azul, state, 1, take(factory(99), 'blue', 1)), { error: 'No tiles of that color there' });
  assert.deepEqual(applyMove(azul, state, 1, take(CENTER, 'blue', 1)), { error: 'No tiles of that color there' });
  assert.deepEqual(applyMove(azul, state, 1, take(factory(0), 'blue', 3)), { error: 'Those tiles cannot go on that line' });
  assert.deepEqual(applyMove(azul, { ...state, isGameOver: true }, 1, take(factory(0), 'blue', 1)), { error: 'The game is over' });
  assert.deepEqual(applyMove(azul, { ...state, activePlayers: [1] }, 1, take(factory(0), 'blue', 1)), { error: 'Waiting for more players' });
});

test('malformed moves are refused', () => {
  const state = game({ factories: OPENING });
  const malformed: unknown[] = [
    null,
    undefined,
    'blue',
    {},
    { source: factory(0), color: 'blue' },
    { source: factory(0), color: 'green', line: 1 },
    { source: factory(0), color: 'blue', line: 5 },
    { source: factory(0), color: 'blue', line: -1 },
    { source: factory(0), color: 'blue', line: 1.5 },
    { source: factory(0), color: 'blue', line: '1' },
    { source: { type: 'factory', index: '0' }, color: 'blue', line: 1 },
    { source: { type: 'factory', index: 0.5 }, color: 'blue', line: 1 },
    { source: { type: 'bag' }, color: 'blue', line: 1 },
    { source: null, color: 'blue', line: 1 }
  ];
  for (const move of malformed) {
    assert.deepEqual(applyMove(azul, state, 1, move), { error: 'Invalid move' }, JSON.stringify(move));
  }
});

// Every player still in the game acknowledges the round summary
function continued(state: GameState, random?: () => number): GameState {
  return state.activePlayers.reduce((current, seat) => ok(acknowledgeRound(current, seat, random)), state);
}

test('the round ends when the table is empty: lines tile the wall and the floor costs points', () => {
  const state = game({
    factories: [['blue', 'blue', 'blue', 'blue'], [], [], [], []],
    roundStarter: 2,
    boards: {
      1: board({
        patternLines: linesOf({ 1: { color: 'red', count: 2 }, 2: { color: 'yellow', count: 1 } }),
        floor: ['red']
      }),
      2: board()
    }
  });
  const scored = ok(applyMove(azul, state, 1, take(factory(0), 'blue', 3)));
  const mine = scored.boards[1];

  assert.deepEqual(mine.wall, wallOf([1, 3], [3, 3]));
  assert.equal(mine.score, 1); // 1 for red, 1 for blue, minus 1 for the floor
  assert.deepEqual(mine.patternLines, linesOf({ 2: { color: 'yellow', count: 1 } })); // unfinished line stays
  assert.deepEqual(mine.floor, []);
  assert.deepEqual([...scored.lid].sort(), ['blue', 'blue', 'blue', 'red', 'red']);

  // Nothing is dealt until everyone has seen the summary
  assert.equal(scored.round, 1);
  assert.equal(scored.currentPlayer, null);
  assert.ok(scored.factories.every(tiles => tiles.length === 0));
  assert.equal(scored.isGameOver, false);
  assert.equal(scored.gameStatus, 'Round 1 scored. Waiting for everyone to continue.');
  assert.deepEqual(scored.roundSummary, {
    round: 1,
    acknowledged: [],
    seats: {
      1: {
        scoreBefore: 0,
        placements: [
          { row: 1, col: 3, color: 'red', points: 1, rowRun: 1, colRun: 1 },
          { row: 3, col: 3, color: 'blue', points: 1, rowRun: 1, colRun: 1 }
        ],
        floor: ['red'],
        floorPenalty: 1,
        bonus: null,
        scoreAfter: 1
      },
      2: { scoreBefore: 0, placements: [], floor: [], floorPenalty: 0, bonus: null, scoreAfter: 0 }
    }
  });
});

test('the next round is dealt once every player has acknowledged the summary', () => {
  const scored = ok(applyMove(azul, 
    game({ factories: [['blue'], [], [], [], []], roundStarter: 2 }),
    1,
    take(factory(0), 'blue', 4)
  ));
  assert.deepEqual(applyMove(azul, scored, 1, take(factory(0), 'blue', 4)), { error: 'Not your turn' });

  const one = ok(acknowledgeRound(scored, 2));
  assert.deepEqual(one.roundSummary?.acknowledged, [2]);
  assert.equal(one.round, 1);
  assert.equal(one.gameStatus, 'Bob is ready for the next round');
  assert.equal(ok(acknowledgeRound(one, 2)), one); // acknowledging twice changes nothing

  const next = ok(acknowledgeRound(one, 1));
  assert.equal(next.roundSummary, null);
  assert.equal(next.round, 2);
  assert.ok(next.factories.every(tiles => tiles.length === 4));
  assert.equal(next.bag.length, 20);
  assert.equal(next.centerHasMarker, true);
  assert.equal(next.markerHolder, null);
  assert.equal(next.currentPlayer, 2); // nobody took the marker, so the same player starts again
  assert.equal(next.roundStarter, 2);
  assert.equal(next.gameStatus, 'Bob starts round 2.');

  assert.deepEqual(acknowledgeRound(next, 1), { error: 'Nothing to continue' });
  assert.deepEqual(acknowledgeRound(game(), 1), { error: 'Nothing to continue' });
});

test('a player leaving no longer holds up the next round', () => {
  const three = game({
    factories: [['blue'], [], [], [], [], [], []],
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    boards: { 1: board(), 2: board(), 3: board() }
  });
  const scored = ok(applyMove(azul, three, 1, take(factory(0), 'blue', 4)));
  const waiting = ok(acknowledgeRound(ok(acknowledgeRound(scored, 1)), 2));
  assert.equal(waiting.round, 1);

  const next = removePlayer(azul, waiting, 3);
  assert.equal(next.round, 2);
  assert.equal(next.roundSummary, null);
  assert.equal(next.currentPlayer, 1);
});

test('tiles placed next to each other in one round score as a run', () => {
  const state = game({
    factories: [['red'], [], [], [], []],
    boards: {
      1: board({ patternLines: linesOf({ 0: { color: 'blue', count: 1 }, 1: { color: 'cyan', count: 2 } }) }),
      2: board()
    }
  });
  const next = ok(applyMove(azul, state, 1, take(factory(0), 'red', 4)));
  assert.deepEqual(next.boards[1].wall, wallOf([0, 0], [1, 0]));
  assert.equal(next.boards[1].score, 3); // 1 for the first, 2 for the one below it
  assert.deepEqual(next.roundSummary?.seats[1].placements, [
    { row: 0, col: 0, color: 'blue', points: 1, rowRun: 1, colRun: 1 },
    { row: 1, col: 0, color: 'cyan', points: 2, rowRun: 1, colRun: 2 }
  ]);
});

test('a score never drops below zero', () => {
  const state = game({
    factories: [['red'], [], [], [], []],
    boards: { 1: board({ score: 3, floor: ['red', 'red', 'red', 'red', 'red', 'red'] }), 2: board() }
  });
  const next = ok(applyMove(azul, state, 1, take(factory(0), 'red', 'floor')));
  assert.equal(next.boards[1].score, 0);
  const summary = next.roundSummary?.seats[1];
  assert.equal(summary?.floorPenalty, 14);
  assert.equal(summary?.scoreBefore, 3);
  assert.equal(summary?.scoreAfter, 0);
});

test('the marker holder starts the next round', () => {
  const taken = game({
    factories: [['red'], [], [], [], []],
    markerHolder: 2,
    centerHasMarker: false,
    boards: { 1: board(), 2: board({ floor: ['first'] }) }
  });
  assert.equal(continued(ok(applyMove(azul, taken, 1, take(factory(0), 'red', 4)))).currentPlayer, 2);

  const lastPick = game({ center: ['red'], roundStarter: 2 });
  const next = continued(ok(applyMove(azul, lastPick, 1, take(CENTER, 'red', 4))));
  assert.equal(next.currentPlayer, 1);
  assert.equal(next.roundStarter, 1);
  assert.equal(next.centerHasMarker, true);
});

test('the next active seat starts when the marker holder has left', () => {
  const state = game({
    factories: [['red'], [], [], [], [], [], []],
    activePlayers: [1, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    boards: { 1: board(), 2: board({ floor: ['first'] }), 3: board() },
    markerHolder: 2,
    centerHasMarker: false
  });
  const next = continued(ok(applyMove(azul, state, 1, take(factory(0), 'red', 4))));
  assert.equal(next.currentPlayer, 3);
  assert.deepEqual(next.boards[2].floor, []); // boards of players who left are still scored
});

test('the lid refills the bag when it runs out', () => {
  const state = game({
    factories: [['blue'], [], [], [], []],
    bag: ['red', 'red'],
    lid: Array<Color>(30).fill('yellow')
  });
  const next = continued(ok(applyMove(azul, state, 1, take(factory(0), 'blue', 'floor'))));
  assert.equal(next.factories.flat().length, 20);
  assert.deepEqual(next.factories[0].slice(0, 2), ['red', 'red']);
  assert.equal(next.bag.length, 13); // 30 yellow and the blue from the floor, less the 18 drawn
  assert.deepEqual(next.lid, []);
});

test('factories stay short when the tiles run out, and the game ends when none are left', () => {
  const short = game({ factories: [['blue'], [], [], [], []], bag: ['red'] });
  const next = continued(ok(applyMove(azul, short, 1, take(factory(0), 'blue', 4))));
  assert.deepEqual(next.factories, [['red'], [], [], [], []]);
  assert.equal(next.isGameOver, false);

  const none = game({ factories: [['blue'], [], [], [], []], bag: [] });
  const over = continued(ok(applyMove(azul, none, 1, take(factory(0), 'blue', 4))));
  assert.equal(over.isGameOver, true);
  assert.deepEqual(over.roundSummary?.seats[1].bonus, { rows: 0, columns: 0, colors: 0, points: 0 });
});

test('moves and acknowledgements wait for an undo vote', () => {
  const voting = { requestedBy: 2, votes: { 2: true } };
  assert.deepEqual(
    applyMove(azul, game({ factories: OPENING, undoVote: voting }), 1, take(factory(0), 'blue', 1)),
    { error: 'An undo vote is in progress' }
  );
  const scored = ok(applyMove(azul, game({ factories: [['blue'], [], [], [], []] }), 1, take(factory(0), 'blue', 4)));
  assert.deepEqual(acknowledgeRound({ ...scored, undoVote: voting }, 1), { error: 'An undo vote is in progress' });
});

test('a complete wall row ends the game after the round, with bonuses', () => {
  const state = game({
    factories: [['blue'], [], [], [], []],
    boards: { 1: board({ wall: wallOf([0, 1], [0, 2], [0, 3], [0, 4]) }), 2: board({ score: 6 }) }
  });
  const next = ok(applyMove(azul, state, 1, take(factory(0), 'blue', 0)));
  assert.equal(next.isGameOver, true);
  assert.equal(next.boards[1].score, 7); // 5 for the run, 2 for the row
  assert.deepEqual(next.winners, [1]);
  assert.equal(next.currentPlayer, null);
  assert.equal(next.round, 1);
  assert.ok(next.factories.every(tiles => tiles.length === 0));
  assert.equal(next.gameStatus, 'Alice wins with 7 points!');
  assert.deepEqual(next.roundSummary?.seats[1], {
    scoreBefore: 0,
    placements: [{ row: 0, col: 0, color: 'blue', points: 5, rowRun: 5, colRun: 1 }],
    floor: [],
    floorPenalty: 0,
    bonus: { rows: 1, columns: 0, colors: 0, points: 2 },
    scoreAfter: 7
  });
  assert.equal(next.roundSummary?.seats[2].scoreAfter, 6);
});

test('a tie on points goes to the player with more complete rows, or is shared', () => {
  const almost = board({ wall: wallOf([0, 1], [0, 2], [0, 3], [0, 4]) });
  const finish = (rival: PlayerBoard) => ok(applyMove(azul, 
    game({ factories: [['blue'], [], [], [], []], boards: { 1: almost, 2: rival } }),
    1,
    take(factory(0), 'blue', 0)
  ));

  assert.deepEqual(finish(board({ score: 7 })).winners, [1]);
  assert.deepEqual(finish(board({ score: 8 })).winners, [2]);

  const shared = finish(board({ score: 5, wall: wallOf(...fullRow(1)) }));
  assert.equal(shared.boards[2].score, 7);
  assert.deepEqual(shared.winners, [1, 2]);
  assert.equal(shared.gameStatus, 'Alice and Bob share the win with 7 points!');
});

test('a player who left cannot win', () => {
  const state = game({
    factories: [['blue'], [], [], [], [], [], []],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    boards: { 1: board({ wall: wallOf([0, 1], [0, 2], [0, 3], [0, 4]) }), 2: board(), 3: board({ score: 50 }) }
  });
  assert.deepEqual(ok(applyMove(azul, state, 1, take(factory(0), 'blue', 0))).winners, [1]);
});

test('leaving mid-game skips the seat, and the last player left wins', () => {
  const three = game({
    factories: OPENING,
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    boards: { 1: board(), 2: board(), 3: board() }
  });
  const afterOne = removePlayer(azul, three, 1);
  assert.deepEqual(afterOne.activePlayers, [2, 3]);
  assert.equal(afterOne.currentPlayer, 2);
  assert.ok(afterOne.boards[1]);
  assert.equal(afterOne.gameStatus, 'Alice was dismissed');
  assert.equal(removePlayer(azul, three, 3).currentPlayer, 1);

  const afterTwo = removePlayer(azul, afterOne, 3);
  assert.equal(afterTwo.isGameOver, true);
  assert.deepEqual(afterTwo.winners, [2]);
  assert.equal(afterTwo.currentPlayer, null);
  assert.equal(afterTwo.gameStatus, 'Bob wins! Everyone else left.');
});

test('a whole game keeps all 100 tiles and reaches an end', () => {
  const random = mulberry32(7);
  let state = createGameState('g');
  for (const name of ['A', 'B', 'C']) {
    const joined = addPlayer(azul, state, name, random);
    if ('error' in joined) assert.fail(joined.error);
    state = joined.state;
  }
  const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)];

  for (let moves = 0; !state.isGameOver; moves++) {
    assert.ok(moves < 2000, 'the game should end');
    const seat = state.currentPlayer;
    if (seat === null) assert.fail('nobody to move');
    const sources: Source[] = state.factories.flatMap((tiles, index) => (tiles.length > 0 ? [factory(index)] : []));
    if (state.center.length > 0) sources.push(CENTER);
    const source = pick(sources);
    const color = pick(sourceColors(state, source));
    const lines = legalLines(state.boards[seat], color);
    state = ok(applyMove(azul, state, seat, take(source, color, lines.length > 0 ? pick(lines) : 'floor')));
    assert.equal(countTiles(state), 100);
    if (!state.isGameOver && state.roundSummary) state = continued(state, random);
    assert.equal(countTiles(state), 100);
  }

  assert.ok(state.winners.length >= 1);
  assert.ok(Object.values(state.boards).some(b => completeRows(b.wall) > 0));
});
