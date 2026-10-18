import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import { meeplesOnBoard, placementOptions, tileFeatures } from './board.ts';
import { carcassonne } from './index.ts';
import { createGameState, meepleError, toPublicState } from './rules.ts';
import { at, game, move, ok, played, refused, START, turn } from './testing.ts';
import type { FeatureRef, GameState, Random, Seat } from './types.ts';

const CITY: FeatureRef = { kind: 'city', index: 0 };
const ROAD: FeatureRef = { kind: 'road', index: 0 };
const MONASTERY: FeatureRef = { kind: 'monastery', index: 0 };
const field = (index: number): FeatureRef => ({ kind: 'field', index });
const meeple = (seat: Seat, feature: FeatureRef) => ({ seat, feature });

function lobby(random: Random, ...names: string[]): GameState {
  let state = createGameState('g1');
  for (const name of names) {
    const result = addPlayer(carcassonne, state, name, random);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

test('setup: the start tile on the board, 71 shuffled, one drawn for the first player', () => {
  const alone = lobby(() => 0, 'Alice');
  assert.deepEqual(alone.board, [START]);
  assert.equal(alone.currentTile, null);
  assert.equal(alone.drawPile.length, 71);

  const state = lobby(() => 0, 'Alice', 'Bob');
  assert.deepEqual(state.board, [START]);
  assert.notEqual(state.currentTile, null);
  assert.equal(state.drawPile.length, 70);
  assert.equal(state.currentPlayer, 1);
  assert.deepEqual(state.scores, { 1: 0, 2: 0 });
  assert.equal(state.placed, false);
});

test('a tile must touch the board and match every edge, turned as placed', () => {
  const state = game(); // E: a city on its north side
  assert.equal(refused(state, 1, { type: 'place', x: 0, y: -1, rotation: 0 }), 'The tile must match the edges of the tiles next to it');
  assert.equal(refused(state, 1, { type: 'place', x: 5, y: 5, rotation: 0 }), 'The tile must touch a tile already on the board');
  assert.equal(refused(state, 1, { type: 'place', x: 0, y: 0, rotation: 0 }), 'That square is taken');
  const placed = played(state, 1, { type: 'place', x: 0, y: -1, rotation: 2 }); // city turned to face south
  assert.equal(placed.placed, true);
  assert.deepEqual(placed.board[1], { ...at(0, -1, 'E', 2), by: 1 });
  assert.equal(placed.currentPlayer, 1);
  assert.equal(refused(placed, 1, { type: 'place', x: 1, y: 0, rotation: 0 }), 'Your tile is placed: choose a meeple or none');

  // E fits north of the start tile only with its city facing south
  const north = placementOptions([START], 'E').find(option => option.x === 0 && option.y === -1);
  assert.deepEqual(north?.rotations, [2]);
});

test('a completed city scores 2 a tile and its meeple goes back', () => {
  const after = turn(game(), 1, 0, -1, 2, CITY);
  assert.equal(after.scores[1], 4);
  assert.equal(meeplesOnBoard(after.board, 1), 0);
  assert.equal(after.currentPlayer, 2);
  assert.equal(after.currentTile, 'U');
  assert.deepEqual(after.lastMove, {
    type: 'meeple', playerNumber: 1, feature: CITY, discarded: [],
    scored: [{ kind: 'city', complete: true, tiles: 2, points: 4, seats: [1], meeples: [1] }]
  });
});

test('a completed city adds 2 a pennant', () => {
  // M turned twice: its pennant city faces south onto the start tile and east, where E closes it
  const state = game({ board: [START, at(0, -1, 'M', 2, meeple(2, CITY))] });
  const after = turn(state, 1, 1, -1, 3);
  assert.equal(after.scores[2], 8); // 3 tiles and a pennant, 2 each
  assert.equal(after.scores[1], 0);
  assert.equal(after.board[1].meeple, null);
});

test('a completed road scores 1 a tile', () => {
  let state = game({ currentTile: 'A', drawPile: ['U', 'A'] });
  state = turn(state, 1, 1, 0, 1, ROAD); // the road ends at the monastery, east of the start tile
  assert.equal(state.scores[1], 0);
  state = turn(state, 2, -1, 0, 3, MONASTERY); // and at another monastery to the west
  assert.equal(state.scores[1], 3);
  assert.equal(meeplesOnBoard(state.board, 1), 0);
  assert.equal(meeplesOnBoard(state.board, 2), 1); // the monastery is not complete
});

test('a completed monastery scores 9', () => {
  const ring = [-1, 0, 1].flatMap(x => [-1, 0, 1].map(y => ({ x, y }))).filter(({ x, y }) => !(x === 1 && y === 1));
  const board = ring.map(({ x, y }) => at(x, y, 'B', 0, x === 0 && y === 0 ? meeple(1, MONASTERY) : null));
  const after = turn(game({ board, currentTile: 'B', currentPlayer: 2 }), 2, 1, 1, 0);
  assert.equal(after.scores[1], 9);
  assert.equal(after.board[ring.findIndex(({ x, y }) => x === 0 && y === 0)].meeple, null);
});

test('a meeple cannot join a feature that already has one, or a feature the tile lacks', () => {
  const state = game({ board: [START, at(1, 0, 'U', 1, meeple(2, ROAD))], currentTile: 'U' });
  const placed = played(state, 1, { type: 'place', x: -1, y: 0, rotation: 1 });
  assert.equal(refused(placed, 1, { type: 'meeple', feature: ROAD }), 'That feature already has a meeple on it');
  assert.equal(refused(placed, 1, { type: 'meeple', feature: CITY }), 'That tile has no such feature');
  assert.equal(meepleError(placed, 1, field(0)), null); // the field south of the road is free
  const after = played(placed, 1, { type: 'meeple', feature: field(0) });
  assert.deepEqual(after.board[2].meeple, meeple(1, field(0)));
});

test('a player with all 7 meeples out places none', () => {
  const out = Array.from({ length: 7 }, (_, index) => at(10 + 2 * index, 10, 'B', 0, meeple(1, MONASTERY)));
  const placed = played(game({ board: [START, ...out] }), 1, { type: 'place', x: 0, y: -1, rotation: 2 });
  assert.equal(refused(placed, 1, { type: 'meeple', feature: CITY }), 'All your meeples are on the board');
  assert.equal(played(placed, 1, { type: 'meeple', feature: null }).currentPlayer, 2);
});

// The start tile's city, then G turned to run north and south, closed by E for Cara
function sharedCity(): GameState {
  const board = [at(0, 0, 'D', 0, meeple(1, CITY)), at(0, -1, 'G', 1, meeple(2, CITY))];
  return game({ board, currentPlayer: 3 });
}

test('a shared feature scores in full for every tied player', () => {
  const after = turn(sharedCity(), 3, 0, -2, 2);
  assert.deepEqual([after.scores[1], after.scores[2], after.scores[3]], [6, 6, 0]);
  assert.equal(meeplesOnBoard(after.board, 1) + meeplesOnBoard(after.board, 2), 0);
});

test('the most meeples on a feature take all its points', () => {
  const board = [at(0, 0, 'D', 0, meeple(1, CITY)), at(0, -1, 'F', 1, meeple(1, CITY)), at(0, -2, 'G', 1, meeple(2, CITY))];
  const after = turn(game({ board, currentPlayer: 3 }), 3, 0, -3, 2);
  assert.equal(after.scores[1], 10); // 4 tiles and a pennant
  assert.equal(after.scores[2], 0);
  assert.equal(meeplesOnBoard(after.board, 2), 0); // Bob's meeple comes back too
});

test('at the end, unfinished features and fields score', () => {
  const board = [
    at(0, 0, 'D', 0, meeple(1, field(0))), // the strip between the city and the road
    at(0, -1, 'E', 2), // closes the start tile's city
    at(1, 0, 'U', 1, meeple(2, field(0))), // the field south of the road, which borders no city
    at(-1, 0, 'U', 1, meeple(3, ROAD))
  ];
  const state = game({ board, currentTile: 'B', drawPile: [] });
  const after = turn(state, 1, 0, 1, 0, MONASTERY);
  assert.equal(after.isGameOver, true);
  assert.equal(after.currentTile, null);
  assert.equal(after.currentPlayer, null);
  assert.deepEqual(after.finalScores, {
    1: { road: 0, city: 0, monastery: 4, field: 3 }, // 1 and the 3 tiles around it; 3 for the completed city
    2: { road: 0, city: 0, monastery: 0, field: 0 },
    3: { road: 3, city: 0, monastery: 0, field: 0 } // the unfinished road over three tiles
  });
  assert.deepEqual(after.scores, { 1: 7, 2: 0, 3: 3 });
  assert.deepEqual(after.winners, [1]);
  assert.match(after.gameStatus, /Alice wins with 7 points/);
});

test('a field scores 3 for each completed city it borders, each city once, by majority', () => {
  // H's field runs between its two cities; E tiles close both. The B tiles north and south join the field,
  // so Cara has two farmers on it to Bob's one.
  const board = [
    at(0, 0, 'H', 0, meeple(2, field(0))),
    at(1, 0, 'E', 3),
    at(-1, 0, 'E', 1),
    at(0, -1, 'B', 0, meeple(3, field(0))),
    at(0, 1, 'B', 0, meeple(3, field(0)))
  ];
  const after = turn(game({ board, currentTile: 'U', drawPile: [] }), 1, 2, 0, 0);
  assert.equal(after.finalScores?.[3].field, 6);
  assert.equal(after.finalScores?.[2].field, 0);
});

test('an unfinished city scores 1 a tile and 1 a pennant at the end', () => {
  const state = game({ board: [START, at(0, -1, 'M', 2, meeple(2, CITY))], currentTile: 'B', drawPile: [] });
  const after = turn(state, 1, 0, 1, 0);
  assert.equal(after.finalScores?.[2].city, 3);
  assert.equal(after.scores[2], 3);
});

test('tied highest scores share the win', () => {
  const after = turn({ ...sharedCity(), drawPile: [] }, 3, 0, -2, 2);
  assert.equal(after.isGameOver, true);
  assert.deepEqual(after.winners, [1, 2]);
  assert.match(after.gameStatus, /Alice and Bob share the win with 6 points/);
});

test('a drawn tile that fits nowhere leaves the game and another is drawn', () => {
  // Around a lone straight road nothing shows a city, so C (all city) fits nowhere
  const state = game({ board: [at(0, 0, 'U')], currentTile: 'B', drawPile: ['B', 'C'] });
  const after = turn(state, 1, 1, 0, 0);
  assert.equal(after.currentTile, 'B');
  assert.deepEqual(after.discarded, ['C']);
  assert.equal(after.lastMove?.type === 'meeple' && after.lastMove.discarded.length, 1);
  assert.equal(after.isGameOver, false);

  const last = turn(game({ board: [at(0, 0, 'U')], currentTile: 'B', drawPile: ['C'] }), 1, 1, 0, 0);
  assert.equal(last.isGameOver, true);
  assert.deepEqual(last.discarded, ['C']);
});

test('invalid moves are refused and change nothing', () => {
  const state = game();
  const before = structuredClone(state);
  const bad: unknown[] = [
    null, 'place', {}, { type: 'fly' },
    { type: 'place', x: 0, y: -1 },
    { type: 'place', x: 0.5, y: -1, rotation: 2 },
    { type: 'place', x: 0, y: -1, rotation: 4 },
    { type: 'place', x: '0', y: -1, rotation: 2 },
    { type: 'place', x: 1e9, y: -1, rotation: 2 },
    { type: 'meeple', feature: CITY },
    { type: 'meeple', feature: { kind: 'castle', index: 0 } },
    { type: 'meeple', feature: { kind: 'city', index: -1 } },
    { type: 'meeple' }
  ];
  for (const value of bad) assert.ok('error' in move(state, 1, value), JSON.stringify(value));
  assert.equal(refused(state, 2, { type: 'place', x: 0, y: -1, rotation: 2 }), 'Not your turn');
  assert.deepEqual(state, before);

  const placed = played(state, 1, { type: 'place', x: 0, y: -1, rotation: 2 });
  assert.ok('error' in move(placed, 1, { type: 'meeple', feature: { kind: 'road', index: 0 } }));
  assert.ok('error' in move(placed, 1, { type: 'meeple', feature: { kind: 'city', index: 2 } }));
  assert.equal(refused(game({ currentTile: null }), 1, { type: 'place', x: 0, y: -1, rotation: 2 }), 'There is no tile to place');
});

test('dismissed player mid-turn: before placing, the next player places the same tile', () => {
  const after = removePlayer(carcassonne, game(), 1, () => 0);
  assert.deepEqual(after.activePlayers, [2, 3]);
  assert.equal(after.currentPlayer, 2);
  assert.equal(after.currentTile, 'E');
  assert.equal(after.placed, false);
  assert.equal(played(after, 2, { type: 'place', x: 0, y: -1, rotation: 2 }).board.length, 2);
});

test('dismissed player mid-turn: after placing, the turn ends without a meeple and the next tile is drawn', () => {
  const placed = played(sharedCity(), 3, { type: 'place', x: 0, y: -2, rotation: 2 });
  const after = removePlayer(carcassonne, placed, 3, () => 0);
  assert.equal(after.placed, false);
  assert.equal(after.currentPlayer, 1);
  assert.equal(after.currentTile, 'U');
  assert.equal(after.board.length, 3);
  assert.deepEqual([after.scores[1], after.scores[2]], [6, 6]); // the city it closed still scores
  assert.equal(after.lastMove?.type, 'meeple');
});

test('a dismissed player\'s meeples count for nobody but still hold their feature', () => {
  const state = removePlayer(carcassonne, sharedCity(), 1, () => 0); // Alice leaves; Bob and Alice share the city
  assert.equal(state.currentPlayer, 3);
  const after = turn(state, 3, 0, -2, 2);
  assert.equal(after.scores[2], 6);
  assert.equal(after.scores[1], 0);
  assert.equal(meeplesOnBoard(after.board, 1), 0);

  // A feature holding only a dismissed player's meeple stays taken
  const held = removePlayer(carcassonne, game({ board: [START, at(1, 0, 'U', 1, meeple(1, ROAD))], currentPlayer: 2, currentTile: 'U' }), 1, () => 0);
  const placed = played(held, 2, { type: 'place', x: -1, y: 0, rotation: 1 });
  assert.equal(refused(placed, 2, { type: 'meeple', feature: ROAD }), 'That feature already has a meeple on it');
});

// The same draws on every run
function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A simple player: the first square and turn that fit, and a meeple on the first free feature
function botTurn(state: GameState): GameState {
  const seat = state.currentPlayer!;
  const [option] = placementOptions(state.board, state.currentTile!);
  const placed = ok(applyMove(carcassonne, state, seat, { type: 'place', x: option.x, y: option.y, rotation: option.rotations[0] }));
  const feature = tileFeatures(placed.currentTile!).find(ref => meepleError(placed, seat, ref) === null) ?? null;
  return ok(applyMove(carcassonne, placed, seat, { type: 'meeple', feature }));
}

test('table view hides the draw order over every step of a game', () => {
  let state = lobby(seeded(4), 'Alice', 'Bob');
  const steps = [state];
  while (!state.isGameOver) {
    state = botTurn(state);
    steps.push(state);
  }
  assert.equal(state.board.length + state.discarded.length, 72);
  for (const step of steps) {
    const view = toPublicState(step, false);
    assert.equal('drawPile' in view, false);
    assert.equal(view.tilesLeft, step.drawPile.length);
    assert.equal(JSON.stringify(view).includes('drawPile'), false);
  }
  assert.ok(Object.values(state.scores).some(score => score > 0));
  assert.deepEqual(state.winners.length > 0, true);
});
