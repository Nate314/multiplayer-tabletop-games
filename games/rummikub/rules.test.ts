import { finalStandings } from './rules.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLORS,
  JOKERS,
  RACK_SIZE,
  analyzeGroup,
  createGameState,
  fullPool,
  rackTotal,
  tileOf,
  toPublicState
} from './rules.ts';
import { rummikub } from './index.ts';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import type { GameState, Move, Result, Seat, Table, TileColor } from './types.ts';

// Always picks the first choice, so shuffles and deals are predictable
const first = () => 0;

const [J1, J2] = JOKERS;

// The id of a numbered tile; `copy` picks which of the two identical tiles
function t(color: TileColor, value: number, copy = 0): number {
  return copy * 52 + COLORS.indexOf(color) * 13 + value - 1;
}

function lobby(...names: string[]): GameState {
  let state = createGameState('g1');
  for (const name of names) {
    const result = addPlayer(rummikub, state, name, first);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

// A game in progress with chosen racks and table. Every other tile is in the pool.
function game(racks: Record<Seat, number[]>, table: Table = [], melded: Seat[] = [1, 2]): GameState {
  const seats = Object.keys(racks).map(Number);
  const state = lobby(...seats.map(seat => `P${seat}`));
  const used = new Set([...Object.values(racks).flat(), ...table.flat()]);
  return {
    ...state,
    started: true,
    currentPlayer: seats[0],
    racks,
    table,
    pool: fullPool().filter(id => !used.has(id)),
    melded
  };
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function move(state: GameState, seat: Seat, input: Move | unknown): Result<GameState> {
  return applyMove(rummikub, state, seat, input, first);
}

function play(state: GameState, seat: Seat, table: Table): Result<GameState> {
  return move(state, seat, { type: 'play', table });
}

const RED_RUN = [t('red', 10), t('red', 11), t('red', 12)]; // 33 points

test('106 tiles and 14 each', () => {
  const pool = fullPool();
  assert.equal(pool.length, 106);
  assert.equal(new Set(pool).size, 106);
  const tiles = pool.map(tileOf);
  assert.equal(tiles.filter(tile => tile.kind === 'joker').length, 2);
  for (const color of COLORS) {
    for (let value = 1; value <= 13; value++) {
      assert.equal(tiles.filter(tile => tile.kind === 'number' && tile.color === color && tile.value === value).length, 2);
    }
  }

  const state = lobby('A', 'B', 'C');
  for (const seat of [1, 2, 3]) assert.equal(state.racks[seat].length, RACK_SIZE);
  assert.equal(state.pool.length, 106 - 3 * 14);
  const dealt = [...state.pool, ...Object.values(state.racks).flat()];
  assert.equal(new Set(dealt).size, 106);
  assert.deepEqual(state.table, []);
  assert.deepEqual(state.melded, []);
});

test('the highest tile drawn goes first and tied players draw again', () => {
  // The pool is in id order and each draw takes the first tile left: black 1 for A, black 2 for B
  const state = lobby('A', 'B');
  assert.equal(state.currentPlayer, 2);
  assert.match(state.gameStatus, /A drew black 1, B drew black 2\. B goes first\./);

  // With a random that always picks the last tile, both draw a joker, which counts lowest, so they draw again:
  // red 13 for A and red 12 for B
  const last = () => 0.999;
  let other = createGameState('g2');
  for (const name of ['A', 'B']) {
    const result = addPlayer(rummikub, other, name, last);
    if ('error' in result) assert.fail(result.error);
    other = result.state;
  }
  assert.equal(other.currentPlayer, 1);
});

test('set is 3 or 4 of one number in different colors', () => {
  assert.equal(analyzeGroup([t('red', 7), t('blue', 7), t('black', 7)])?.kind, 'set');
  assert.equal(analyzeGroup([t('red', 7), t('blue', 7), t('black', 7), t('orange', 7)])?.kind, 'set');
  assert.equal(analyzeGroup([t('red', 7), t('blue', 7)]), null);
  assert.equal(analyzeGroup([t('red', 7), t('red', 7, 1), t('black', 7)]), null);
  assert.equal(analyzeGroup([t('red', 7), t('blue', 7), t('black', 8)]), null);
  assert.equal(analyzeGroup([t('red', 7), t('blue', 7), t('black', 7), t('orange', 7), J1]), null);
  // A joker stands for the number of the set, in a missing color
  const withJoker = analyzeGroup([t('red', 7), J1, t('black', 7)]);
  assert.deepEqual(withJoker?.values, [7, 7, 7]);
  assert.equal(withJoker?.points, 21);
});

test('run is 3 or more in a row of one color, no wrap from 13 to 1', () => {
  assert.equal(analyzeGroup([t('blue', 3), t('blue', 4), t('blue', 5)])?.kind, 'run');
  assert.equal(analyzeGroup(Array.from({ length: 13 }, (_, i) => t('blue', i + 1)))?.kind, 'run');
  assert.equal(analyzeGroup([t('blue', 3), t('blue', 4)]), null);
  assert.equal(analyzeGroup([t('blue', 3), t('red', 4), t('blue', 5)]), null);
  assert.equal(analyzeGroup([t('blue', 3), t('blue', 5), t('blue', 6)]), null);
  assert.equal(analyzeGroup([t('blue', 12), t('blue', 13), t('blue', 1)]), null);
  assert.equal(analyzeGroup([t('blue', 13), t('blue', 1), t('blue', 2)]), null);
  // Given out of order, a run is put in order
  assert.deepEqual(analyzeGroup([t('blue', 5), t('blue', 3), t('blue', 4)])?.tiles, [t('blue', 3), t('blue', 4), t('blue', 5)]);
});

test('joker values are inferred from their place in the group', () => {
  // Where it was put: before the 4, so it is a 3
  assert.deepEqual(analyzeGroup([J1, t('red', 4), t('red', 5)])?.values, [3, 4, 5]);
  assert.deepEqual(analyzeGroup([t('red', 4), t('red', 5), J1])?.values, [4, 5, 6]);
  assert.deepEqual(analyzeGroup([t('red', 4), J1, t('red', 6)])?.values, [4, 5, 6]);
  // Out of order, it fills the gap
  assert.deepEqual(analyzeGroup([t('red', 6), t('red', 4), J1])?.tiles, [t('red', 4), J1, t('red', 6)]);
  // At the top it cannot go past 13, so it goes below
  assert.deepEqual(analyzeGroup([t('red', 12), t('red', 13), J1])?.values, [11, 12, 13]);
  assert.equal(analyzeGroup([t('red', 12), t('red', 13), J1])?.points, 36);
});

test('first meld must reach 30 from own tiles and may not touch the table', () => {
  const blackRun = [t('black', 1), t('black', 2), t('black', 3)];
  const state = game({ 1: [...RED_RUN, t('blue', 1), t('blue', 2), t('blue', 3), t('red', 9)], 2: [t('orange', 5)] }, [blackRun], [2]);

  const tooLow = play(state, 1, [blackRun, [t('blue', 1), t('blue', 2), t('blue', 3)]]);
  assert.deepEqual(tooLow, { error: 'Your first meld must total at least 30 points (this one totals 6)' });

  // Two groups together reach 30
  const two = ok(play(state, 1, [blackRun, [t('blue', 1), t('blue', 2), t('blue', 3)], RED_RUN]));
  assert.deepEqual(two.melded, [2, 1]);
  assert.deepEqual(two.lastMove, { type: 'play', playerNumber: 1, added: [...[1, 2, 3].map(v => t('blue', v)), ...RED_RUN], meld: 39, wentOut: false });
  assert.equal(two.currentPlayer, 2);

  // A new group of your own may be any length
  assert.ok('state' in play(state, 1, [blackRun, [t('red', 9), ...RED_RUN]]));

  // Adding to a group on the table is not allowed in the first meld
  const withFour = game({ 1: [...RED_RUN, t('black', 4)], 2: [t('orange', 5)] }, [blackRun], [2]);
  const meldError = { error: 'Your first meld may not use or change the tiles on the table' };
  assert.deepEqual(play(withFour, 1, [[...blackRun, t('black', 4)], RED_RUN]), meldError);

  // Nor is taking a tile from the table into a new group
  const longRun = [...blackRun, t('black', 4)];
  const taking = game({ 1: [...RED_RUN, t('blue', 4), t('orange', 4)], 2: [t('orange', 5)] }, [longRun], [2]);
  assert.deepEqual(play(taking, 1, [blackRun, [t('black', 4), t('blue', 4), t('orange', 4)], RED_RUN]), meldError);

  // Nor is reordering a table group, which would change what its joker stands for (a 6 here, a 3 after)
  const withJoker = game({ 1: RED_RUN, 2: [t('orange', 5)] }, [[t('blue', 4), t('blue', 5), J1]], [2]);
  assert.deepEqual(play(withJoker, 1, [[J1, t('blue', 4), t('blue', 5)], RED_RUN]), meldError);
  assert.ok('state' in play(withJoker, 1, [[t('blue', 4), t('blue', 5), J1], RED_RUN]));
});

test('a joker in a first meld counts as the tile it stands for', () => {
  const state = game({ 1: [t('red', 10), t('red', 11), J1, t('blue', 2)], 2: [t('orange', 5)] }, [], []);
  const result = ok(play(state, 1, [[t('red', 10), t('red', 11), J1]]));
  assert.equal(result.lastMove?.type === 'play' && result.lastMove.meld, 33);
});

test('a play must add at least one rack tile and leave every group valid', () => {
  const table = [[t('blue', 3), t('blue', 4), t('blue', 5)]];
  const state = game({ 1: [t('blue', 6), t('red', 1)], 2: [t('orange', 5)] }, table);

  assert.deepEqual(play(state, 1, table), { error: 'Play at least one tile from your rack' });
  assert.deepEqual(play(state, 1, [...table, [t('red', 1)]]), { error: 'Group 2 is not a valid set or run' });
  assert.deepEqual(play(state, 1, [[t('blue', 3), t('blue', 4)], [t('blue', 5), t('blue', 6)]]), { error: 'Group 1 is not a valid set or run' });
  assert.deepEqual(play(state, 1, [[...table[0], t('blue', 6)], []]), { error: 'Group 2 is not a valid set or run' });

  const after = ok(play(state, 1, [[t('blue', 6), t('blue', 3), t('blue', 4), t('blue', 5)]]));
  assert.deepEqual(after.table, [[t('blue', 3), t('blue', 4), t('blue', 5), t('blue', 6)]]);
  assert.deepEqual(after.racks[1], [t('red', 1)]);
  assert.equal(after.gameStatus, 'P1 played 1 tile');
});

test('a play may split a run and move tiles into new groups', () => {
  const table = [
    [t('red', 4), t('red', 5), t('red', 6), t('red', 7), t('red', 8)],
    [t('blue', 6), t('blue', 7), t('blue', 8), t('blue', 9)]
  ];
  const state = game({ 1: [t('red', 6, 1), t('black', 6), t('orange', 6), t('red', 1)], 2: [t('orange', 5)] }, table);
  // The red run splits around a second red 6, and the blue 6 leaves its run for a set of 6s
  const after = ok(play(state, 1, [
    [t('red', 4), t('red', 5), t('red', 6)],
    [t('red', 6, 1), t('red', 7), t('red', 8)],
    [t('blue', 7), t('blue', 8), t('blue', 9)],
    [t('blue', 6), t('black', 6), t('orange', 6)]
  ]));
  assert.equal(after.table.length, 4);
  assert.deepEqual(after.racks[1], [t('red', 1)]);
  assert.deepEqual(after.lastMove, {
    type: 'play', playerNumber: 1, added: [t('red', 6, 1), t('black', 6), t('orange', 6)], meld: null, wentOut: false
  });
  assert.equal(after.gameStatus, 'P1 played 3 tiles');
});

test('a play may merge groups with the tile that joins them', () => {
  const table = [[t('red', 1), t('red', 2), t('red', 3)], [t('red', 5), t('red', 6), t('red', 7)]];
  const state = game({ 1: [t('red', 4), t('blue', 1)], 2: [t('orange', 5)] }, table);
  const merged = ok(play(state, 1, [[1, 2, 3, 4, 5, 6, 7].map(value => t('red', value))]));
  assert.deepEqual(merged.table, [[1, 2, 3, 4, 5, 6, 7].map(value => t('red', value))]);
});

test('a play may not take a table tile back to the rack', () => {
  const table = [[t('blue', 3), t('blue', 4), t('blue', 5), t('blue', 6)]];
  const state = game({ 1: [t('red', 1), t('red', 2), t('red', 3)], 2: [t('orange', 5)] }, table);
  assert.deepEqual(
    play(state, 1, [[t('blue', 3), t('blue', 4), t('blue', 5)], [t('red', 1), t('red', 2), t('red', 3)]]),
    { error: 'Tiles on the table must stay on the table' }
  );
});

test('a joker taken from the table must be replaced by its tile and played again that turn', () => {
  // Red 4, a joker as red 5, red 6
  const table = [[t('red', 4), J1, t('red', 6)]];
  const state = game({ 1: [t('red', 5), t('blue', 9), t('black', 9), t('red', 8)], 2: [t('orange', 5)] }, table);

  // The red 5 takes the joker's place and the joker goes into a new set
  const swapped = ok(play(state, 1, [[t('red', 4), t('red', 5), t('red', 6)], [t('blue', 9), t('black', 9), J1]]));
  assert.deepEqual(swapped.table, [[t('red', 4), t('red', 5), t('red', 6)], [t('blue', 9), t('black', 9), J1]]);

  // It may not go back to the rack
  assert.deepEqual(play(state, 1, [[t('red', 4), t('red', 5), t('red', 6)]]), { error: 'Tiles on the table must stay on the table' });

  // A joker on the end of a run cannot simply be taken off: the red 7 it stands for must take its place
  const endTable = [[t('red', 4), t('red', 5, 1), t('red', 6), J1]];
  const freed = [[t('blue', 9), t('black', 9), J1]];
  const noSeven = game({ 1: [t('red', 8), t('blue', 9), t('black', 9)], 2: [t('orange', 5)] }, endTable);
  assert.deepEqual(
    play(noSeven, 1, [[t('red', 4), t('red', 5, 1), t('red', 6)], ...freed]),
    { error: 'A joker taken from the table must be replaced by the tile it stands for' }
  );
  const withSeven = game({ 1: [t('red', 7), t('blue', 9), t('black', 9)], 2: [t('orange', 5)] }, endTable);
  assert.ok('state' in play(withSeven, 1, [[t('red', 4), t('red', 5, 1), t('red', 6), t('red', 7)], ...freed]));

  // In a set of three, either missing color frees the joker
  const set = [[t('red', 9), t('blue', 9), J2]];
  for (const color of ['black', 'orange'] as const) {
    const fromSet = game({ 1: [t(color, 9), t('red', 2), t('red', 3)], 2: [t('orange', 5)] }, set);
    assert.ok('state' in play(fromSet, 1, [[t('red', 9), t('blue', 9), t(color, 9)], [J2, t('red', 2), t('red', 3)]]), color);
  }

  // One tile frees only one joker: with two jokers in a set of 5s, the black 5 frees one, and the other then
  // stands only for the orange 5, which must be put in too
  const twoJokers = [[t('red', 5), t('blue', 5), J1, J2]];
  const oneTile = game({ 1: [t('black', 5), t('orange', 9), t('orange', 10)], 2: [t('orange', 1)] }, twoJokers);
  assert.deepEqual(
    play(oneTile, 1, [[t('red', 5), t('blue', 5), t('black', 5)], [t('orange', 9), t('orange', 10), J1, J2]]),
    { error: 'A joker taken from the table must be replaced by the tile it stands for' }
  );
  const twoTiles = game({ 1: [t('black', 5), t('orange', 5), t('orange', 9), t('orange', 10)], 2: [t('orange', 1)] }, twoJokers);
  assert.ok('state' in play(twoTiles, 1, [
    [t('red', 5), t('blue', 5), t('black', 5), t('orange', 5)], [t('orange', 9), t('orange', 10), J1, J2]
  ]));

  // Taking a tile out of a set of four that holds a joker leaves the joker where it is
  const four = [[t('red', 8), t('blue', 8), t('black', 8), J2]];
  const fromFour = game({ 1: [t('red', 6), t('red', 7), t('blue', 1)], 2: [t('orange', 5)] }, four);
  assert.ok('state' in play(fromFour, 1, [[t('blue', 8), t('black', 8), J2], [t('red', 6), t('red', 7), t('red', 8)]]));

  // Adding to a run that holds a joker leaves the joker standing for the same tile, which needs no replacing
  const adding = game({ 1: [t('red', 7), t('blue', 1)], 2: [t('orange', 5)] }, table);
  assert.deepEqual(ok(play(adding, 1, [[t('red', 4), J1, t('red', 6), t('red', 7)]])).table, [[t('red', 4), J1, t('red', 6), t('red', 7)]]);
});

test('the tile that replaces a joker must come from the rack', () => {
  const table = [[t('red', 4), J1, t('red', 6)], [t('red', 5, 1), t('blue', 5), t('black', 5), t('orange', 5)]];
  const state = game({ 1: [t('blue', 9), t('orange', 9), t('black', 1)], 2: [t('orange', 1)] }, table);
  assert.deepEqual(
    play(state, 1, [[t('red', 4), t('red', 5, 1), t('red', 6)], [t('blue', 5), t('black', 5), t('orange', 5)], [t('blue', 9), t('orange', 9), J1]]),
    { error: 'The tile that replaces a joker must come from your rack' }
  );
});

test('a freed joker needs two more rack tiles in its group', () => {
  const table = [[t('red', 4), J1, t('red', 6)], [t('blue', 7), t('blue', 8), t('blue', 9)]];
  const swapped = [t('red', 4), t('red', 5), t('red', 6)];
  const oneMore = game({ 1: [t('red', 5), t('blue', 11)], 2: [t('orange', 1)] }, table);
  assert.deepEqual(
    play(oneMore, 1, [swapped, [t('blue', 7), t('blue', 8), t('blue', 9), J1, t('blue', 11)]]),
    { error: 'A joker taken from the table must be played again with at least two tiles from your rack' }
  );
  const twoMore = game({ 1: [t('red', 5), t('blue', 11), t('blue', 12)], 2: [t('orange', 1)] }, table);
  assert.ok('state' in play(twoMore, 1, [swapped, [t('blue', 7), t('blue', 8), t('blue', 9), J1, t('blue', 11), t('blue', 12)]]));
});

test('a joker that comes to stand for another tile in its own group counts as taken', () => {
  const table = [[t('red', 4), t('red', 5), J1]];
  const sixOnly = game({ 1: [t('red', 6), t('blue', 1)], 2: [t('orange', 1)] }, table);
  assert.deepEqual(
    play(sixOnly, 1, [[t('red', 4), t('red', 5), t('red', 6), J1]]),
    { error: 'A joker taken from the table must be played again with at least two tiles from your rack' }
  );
  const withMore = game({ 1: [t('red', 6), t('red', 8), t('red', 9)], 2: [t('orange', 1)] }, table);
  assert.ok('state' in play(withMore, 1, [[t('red', 4), t('red', 5), t('red', 6), J1, t('red', 8), t('red', 9)]]));
});

test('drawing takes a tile from the pool and passes the turn', () => {
  const state = game({ 1: [t('red', 1)], 2: [t('orange', 5)] });
  const after = ok(move(state, 1, { type: 'draw' }));
  assert.equal(after.racks[1].length, 2);
  assert.equal(after.pool.length, state.pool.length - 1);
  assert.equal(after.racks[1][1], state.pool[state.pool.length - 1]);
  assert.equal(after.currentPlayer, 2);
  assert.deepEqual(after.lastMove, { type: 'draw', playerNumber: 1, drew: true });
  assert.equal(after.gameStatus, 'P1 drew a tile');
});

test('emptying the rack ends the round with the scores', () => {
  const table = [[t('blue', 3), t('blue', 4), t('blue', 5)]];
  const state = game({ 1: [t('blue', 6)], 2: [t('orange', 5), J1], 3: [t('red', 13), t('red', 1)] }, table, [1, 2, 3]);
  const after = ok(play(state, 1, [[t('blue', 3), t('blue', 4), t('blue', 5), t('blue', 6)]]));
  assert.equal(after.isGameOver, true);
  assert.deepEqual(after.winners, [1]);
  assert.equal(after.currentPlayer, null);
  assert.deepEqual(after.result, {
    wentOut: 1,
    rackTotals: { 1: 0, 2: 35, 3: 14 },
    tileCounts: { 1: 0, 2: 2, 3: 2 },
    points: { 1: 49, 2: -35, 3: -14 }
  });
  assert.equal(after.gameStatus, 'P1 went out and wins with 49 points!');
  assert.deepEqual(after.lastMove, { type: 'play', playerNumber: 1, added: [t('blue', 6)], meld: null, wentOut: true });
  assert.deepEqual(move(after, 2, { type: 'draw' }), { error: 'The game is over' });
});

test('a first meld may empty the rack at once', () => {
  const state = game({ 1: RED_RUN, 2: [t('orange', 5)] }, [], []);
  const after = ok(play(state, 1, [RED_RUN]));
  assert.equal(after.isGameOver, true);
  assert.deepEqual(after.winners, [1]);
});

test('empty pool and everyone passing a full round: lowest rack wins', () => {
  const racks = { 1: [t('red', 1), t('red', 2)], 2: [J1], 3: [t('blue', 13)] };
  let state: GameState = { ...game(racks, [], [1, 2, 3]), pool: [] };

  state = ok(move(state, 1, { type: 'draw' }));
  assert.deepEqual(state.lastMove, { type: 'draw', playerNumber: 1, drew: false });
  assert.equal(state.gameStatus, 'P1 passed (the pool is empty)');
  assert.equal(state.emptyPoolPasses, 1);
  state = ok(move(state, 2, { type: 'draw' }));
  assert.equal(state.isGameOver, false);
  state = ok(move(state, 3, { type: 'draw' }));

  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.deepEqual(state.result, {
    wentOut: null,
    rackTotals: { 1: 3, 2: 30, 3: 13 },
    tileCounts: { 1: 2, 2: 1, 3: 1 },
    points: { 1: 43, 2: -30, 3: -13 }
  });
  assert.equal(state.gameStatus, 'The pool is empty and nobody can play. P1 wins with the lowest rack (3 points) and scores 43!');
});

test('a play after passes with an empty pool starts the count again; tied low racks share the win', () => {
  const table = [[t('blue', 3), t('blue', 4), t('blue', 5)]];
  const racks = { 1: [t('red', 5)], 2: [t('blue', 6), t('black', 5)], 3: [t('orange', 9)] };
  let state: GameState = { ...game(racks, table, [1, 2, 3]), pool: [] };
  state = ok(move(state, 1, { type: 'draw' }));
  state = ok(play(state, 2, [[t('blue', 3), t('blue', 4), t('blue', 5), t('blue', 6)]]));
  assert.equal(state.emptyPoolPasses, 0);
  state = ok(move(state, 3, { type: 'draw' }));
  state = ok(move(state, 1, { type: 'draw' }));
  assert.equal(state.isGameOver, false);
  state = ok(move(state, 2, { type: 'draw' }));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1, 2]);
  assert.deepEqual(state.result?.points, { 1: 9, 2: 9, 3: -9 });
  assert.equal(
    state.gameStatus,
    'The pool is empty and nobody can play. P1 and P2 share the win with the lowest rack (5 points) and score 9!'
  );
});

test('invalid moves', () => {
  const table = [[t('blue', 3), t('blue', 4), t('blue', 5)]];
  const state = game({ 1: [t('blue', 6), t('red', 1)], 2: [t('orange', 5)] }, table);
  const snapshot = JSON.stringify(state);
  const invalid = { error: 'Invalid move' };
  const shapes: unknown[] = [
    null, 'draw', 42, {}, { type: 'nonsense' }, { type: 'play' }, { type: 'play', table: 'x' }, { type: 'play', table: [3] },
    { type: 'play', table: [[1.5]] }, { type: 'play', table: [[-1]] }, { type: 'play', table: [[106]] },
    { type: 'play', table: [['1']] }, { type: 'play', table: [[null]] }
  ];
  for (const bad of shapes) assert.deepEqual(move(state, 1, bad), invalid, JSON.stringify(bad));

  // Another player's tile, the same tile twice, a seat that is not seated, and not your turn
  assert.deepEqual(play(state, 1, [[...table[0], t('orange', 5)]]), { error: 'You do not have those tiles' });
  assert.deepEqual(play(state, 1, [[...table[0], t('blue', 6)], [t('blue', 6)]]), { error: 'A tile can be in only one group' });
  assert.deepEqual(move(state, 5, { type: 'draw' }), { error: 'Not your turn' });
  assert.deepEqual(move(state, 2, { type: 'draw' }), { error: 'Not your turn' });
  assert.equal(JSON.stringify(state), snapshot);
});

test('dismissed player mid-turn', () => {
  const racks = { 1: [t('red', 1)], 2: [t('orange', 5), t('orange', 6)], 3: [t('blue', 13)] };
  const state: GameState = { ...game(racks, [], [1, 2, 3]), currentPlayer: 2 };
  const after = removePlayer(rummikub, state, 2, first);
  assert.deepEqual(after.activePlayers, [1, 3]);
  assert.equal(after.currentPlayer, 3);
  assert.equal(after.racks[2], undefined);
  assert.equal(after.pool.length, state.pool.length + 2);
  assert.ok(after.pool.includes(t('orange', 5)) && after.pool.includes(t('orange', 6)));
  assert.ok('state' in move(after, 3, { type: 'draw' }));

  // With the pool empty, the dismissed player's tiles refill it and the count of passes starts again
  const passing: GameState = { ...state, pool: [], emptyPoolPasses: 1 };
  const refilled = removePlayer(rummikub, passing, 2, first);
  assert.equal(refilled.isGameOver, false);
  assert.equal(refilled.emptyPoolPasses, 0);
  assert.equal(refilled.pool.length, 2);

  // The last player left wins
  const alone = removePlayer(rummikub, game({ 1: [t('red', 1)], 2: [t('orange', 5)] }), 1, first);
  assert.equal(alone.isGameOver, true);
  assert.deepEqual(alone.winners, [2]);
});

test('table view hides hands', () => {
  // A short game: a first meld, a draw, then the first player goes out
  const states: GameState[] = [game({ 1: [...RED_RUN, t('red', 13)], 2: [t('orange', 5), t('black', 2)] }, [], [])];
  const moves: [Seat, Move][] = [
    [1, { type: 'play', table: [RED_RUN] }],
    [2, { type: 'draw' }],
    [1, { type: 'play', table: [[...RED_RUN, t('red', 13)]] }]
  ];
  for (const [seat, input] of moves) states.push(ok(move(states[states.length - 1], seat, input)));
  assert.equal(states[states.length - 1].isGameOver, true);

  for (const state of states) {
    const view = toPublicState(state, false, null);
    assert.deepEqual(view.rack, []);
    assert.equal('racks' in view, false);
    assert.equal('pool' in view, false);
    assert.deepEqual(view.rackCounts, Object.fromEntries(Object.entries(state.racks).map(([seat, rack]) => [seat, rack.length])));
    assert.equal(view.poolCount, state.pool.length);
    // No rack or pool tile appears anywhere in what the table view sends
    const sent = JSON.stringify(view);
    for (const id of [...Object.values(state.racks).flat(), ...state.pool]) {
      assert.equal(view.table.flat().includes(id), false);
      assert.equal(view.lastMove?.type === 'play' && view.lastMove.added.includes(id), false, sent);
    }
  }

  // A player sees their own rack only
  assert.deepEqual(toPublicState(states[2], false, 2).rack, states[2].racks[2]);
  assert.deepEqual(toPublicState(states[2], false, 1).rack, states[2].racks[1]);
  assert.equal(rackTotal(states[0].racks[1]), 46);
});


test('finalStandings ranks by the points gained or lost', () => {
  const state: GameState = {
    ...createGameState('t'), activePlayers: [1, 2, 3], isGameOver: true, winners: [2],
    result: { wentOut: 2, rackTotals: { 1: 7, 2: 0, 3: 7 }, tileCounts: { 1: 1, 2: 0, 3: 1 }, points: { 1: -7, 2: 14, 3: -7 } }
  };
  assert.deepEqual(finalStandings(state), [
    { seat: 2, place: 1, score: '+14 points' },
    { seat: 1, place: 2, score: '-7 points' }, { seat: 3, place: 2, score: '-7 points' }
  ]);
});

test('finalStandings leaves the scores blank when the game ended without a result', () => {
  const state: GameState = { ...createGameState('t'), activePlayers: [1, 2], isGameOver: true, winners: [1] };
  assert.deepEqual(finalStandings(state), [{ seat: 1, place: 1 }, { seat: 2, place: 2 }]);
});
