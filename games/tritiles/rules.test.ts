import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HAND_SIZES, finalStandings, legalPlays, openingTile, stuckMove, toPublicState, waitingOn } from './rules.ts';
import { tritiles } from './index.ts';
import { TILES } from './tiles.ts';
import { openPlacements } from './grid.ts';
import type { Board, Cell } from './grid.ts';
import { addPlayer, applyMove, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import type { Random } from '../../shared/types.ts';
import type { GameState, Result } from './types.ts';

// The same numbers on every run
function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const noShuffle = () => 0.999999;

const t = (a: number, b: number, c: number) => TILES.findIndex(tile => tile.join() === `${a},${b},${c}`);
const origin: Cell = { x: 0, y: 0, up: true };
// 5-5-5 alone on the board: only a tile with two 5s can touch it
const fives: Board = [{ tile: t(5, 5, 5), cell: origin, corners: [5, 5, 5] }];

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// A three-player round under way: 5-5-5 is on the table, and nobody holds a tile that fits it
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...tritiles.createGameState('g'),
    started: true,
    currentPlayer: 1,
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    scores: { 1: 0, 2: 0, 3: 0 },
    hands: { 1: [t(0, 1, 2), t(0, 0, 0)], 2: [t(1, 1, 1)], 3: [t(2, 2, 2)] },
    pool: [t(0, 0, 1), t(0, 0, 2), t(1, 1, 2), t(0, 3, 4), t(1, 2, 3)],
    board: fives,
    drawsThisTurn: 0,
    leadTile: null,
    ...overrides
  };
}

function lobby(count: number, random: Random = seeded(count)): GameState {
  let state = tritiles.createGameState('g');
  for (const name of ['Alice', 'Bob', 'Cara', 'Dan', 'Eve', 'Finn'].slice(0, count)) {
    const result = addPlayer(tritiles, state, name, random);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

const move = (state: GameState, seat: number, made: unknown) => applyMove(tritiles, state, seat, made, noShuffle);
// The first spot `tile` fits on the board
function playAnywhere(state: GameState, seat: number, tile: number) {
  const [spot] = openPlacements(state.board, tile);
  assert.ok(spot, 'expected the tile to fit');
  return move(state, seat, { type: 'play', tile, ...spot });
}
const act = (state: GameState, seat: number, action: unknown, random: Random = noShuffle) =>
  tritiles.applyAction?.(state, seat, action, random, 0) ?? assert.fail('Tri-Tiles has actions');

test('deal sizes for 2 to 6 players, the rest is the pool', () => {
  for (const count of [2, 3, 4, 5, 6]) {
    const state = lobby(count);
    const size = HAND_SIZES[count];
    assert.equal(size, count === 2 ? 9 : count <= 4 ? 7 : 6);
    for (const seat of state.activePlayers) assert.equal(state.hands[seat].length, size);
    const all = [...Object.values(state.hands).flat(), ...state.pool];
    assert.equal(all.length, 56);
    assert.equal(new Set(all).size, 56);
    assert.equal(state.drawsThisTurn, 0);
    const opening = openingTile(state.hands);
    assert.equal(state.leadTile, opening.tile);
    assert.equal(state.currentPlayer, opening.seat);
  }
});

test('the opening picks the highest triple, else the highest sum', () => {
  assert.deepEqual(openingTile({ 1: [t(4, 4, 4), t(4, 5, 5)], 2: [t(0, 1, 2), t(5, 5, 5)] }), { seat: 2, tile: t(5, 5, 5) });
  assert.deepEqual(openingTile({ 1: [t(4, 5, 5)], 2: [t(0, 0, 0)] }), { seat: 2, tile: t(0, 0, 0) });
  assert.deepEqual(openingTile({ 1: [t(3, 4, 5)], 2: [t(4, 4, 5), t(0, 0, 1)] }), { seat: 2, tile: t(4, 4, 5) });
});

test('the round must open with the lead tile, which scores the opening score', () => {
  const state = game({ board: [], leadTile: t(5, 5, 5), hands: { 1: [t(5, 5, 5), t(4, 4, 5)], 2: [t(1, 1, 1)], 3: [t(2, 2, 2)] } });
  assert.deepEqual(move(state, 1, { type: 'play', tile: t(4, 4, 5), cell: origin, corners: [4, 4, 5] }),
    { error: 'Open the round with the highest triple, or the highest sum if nobody holds a triple' });
  const led = ok(move(state, 1, { type: 'play', tile: t(5, 5, 5), cell: origin, corners: [5, 5, 5] }));
  assert.equal(led.scores[1], 25);
  assert.equal(led.leadTile, null);
  assert.equal(led.currentPlayer, 2);
  assert.deepEqual(led.board, fives);
});

test('a play that does not fit, or is malformed, is refused', () => {
  const state = game({ hands: { 1: [t(0, 1, 2), t(4, 5, 5)], 2: [t(1, 1, 1)], 3: [t(2, 2, 2)] } });
  const right: Cell = { x: 0, y: 0, up: false };
  assert.deepEqual(move(state, 1, { type: 'play', tile: t(0, 1, 2), cell: right, corners: [0, 1, 2] }), { error: 'That tile does not fit there' });
  // 4-5-5 laid as 5-4-5 matches the edge, but not in its other rotations
  for (const corners of [[4, 5, 5], [5, 5, 4]]) {
    assert.deepEqual(move(state, 1, { type: 'play', tile: t(4, 5, 5), cell: right, corners }), { error: 'That tile does not fit there' });
  }
  ok(move(state, 1, { type: 'play', tile: t(4, 5, 5), cell: right, corners: [5, 4, 5] }));
  assert.deepEqual(move(state, 1, { type: 'play', tile: t(4, 5, 5), cell: right, corners: [5, 4, 4] }),
    { error: 'Those corners are not that tile' });
  assert.deepEqual(move(state, 1, { type: 'play', tile: t(2, 2, 2), cell: right, corners: [2, 2, 2] }), { error: 'You do not have that tile' });
  for (const bad of [
    { type: 'play', tile: t(4, 5, 5), cell: { x: 0.5, y: 0, up: false }, corners: [5, 4, 5] },
    { type: 'play', tile: t(4, 5, 5), cell: { x: 0, y: 0 }, corners: [5, 4, 5] },
    { type: 'play', tile: t(4, 5, 5), cell: right, corners: [5, 5] },
    { type: 'play', tile: t(4, 5, 5), cell: right, corners: '554' },
    { type: 'play', tile: 'x', cell: right, corners: [5, 4, 5] },
    { type: 'play', tile: t(4, 5, 5), cell: null, corners: [5, 4, 5] },
    null, 'play', { type: 'shout' }
  ]) assert.deepEqual(move(state, 1, bad), { error: 'Invalid move' });
});

test('a draw costs 5, and a fourth draw in one turn is refused', () => {
  let state = game();
  assert.equal(stuckMove(state.board, state.hands[1], state.pool.length, 0), 'draw');
  for (let draw = 1; draw <= 3; draw++) {
    state = ok(move(state, 1, { type: 'draw' }));
    assert.equal(state.scores[1], -5 * draw);
    assert.equal(state.drawsThisTurn, draw);
    assert.equal(state.currentPlayer, 1);
  }
  assert.equal(state.hands[1].length, 5);
  assert.equal(stuckMove(state.board, state.hands[1], state.pool.length, 3), 'pass');
  assert.deepEqual(move(state, 1, { type: 'draw' }), { error: 'You have drawn 3 tiles this turn' });
});

test('after 3 draws with nothing playable, pass costs another 10 and the next player starts fresh', () => {
  let state = game();
  assert.deepEqual(move(state, 1, { type: 'pass' }), { error: 'Draw from the pool first' });
  for (let draw = 0; draw < 3; draw++) state = ok(move(state, 1, { type: 'draw' }));
  state = ok(move(state, 1, { type: 'pass' }));
  assert.equal(state.scores[1], -25);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.drawsThisTurn, 0);
  assert.equal(ok(move(state, 2, { type: 'draw' })).drawsThisTurn, 1);
});

test('a drawn tile that fits may be played at once, and nobody may draw or pass with a tile that fits', () => {
  const state = game({ pool: [t(0, 0, 1), t(4, 5, 5)] });
  const drawn = ok(move(state, 1, { type: 'draw' }));
  assert.equal(stuckMove(drawn.board, drawn.hands[1], drawn.pool.length, 1), null);
  assert.deepEqual(move(drawn, 1, { type: 'draw' }), { error: 'You have a tile that fits' });
  assert.deepEqual(move(drawn, 1, { type: 'pass' }), { error: 'You have a tile that fits' });
  const played = ok(playAnywhere(drawn, 1, t(4, 5, 5)));
  assert.equal(played.scores[1], -5 + 14);
  assert.equal(played.currentPlayer, 2);
  assert.equal(played.drawsThisTurn, 0);
});

test('empty pool and nothing playable: pass costs 10', () => {
  const state = game({ pool: [], hands: { 1: [t(0, 1, 2)], 2: [t(4, 5, 5)], 3: [t(2, 2, 2)] } });
  assert.deepEqual(move(state, 1, { type: 'draw' }), { error: 'You have nothing to draw' });
  const passed = ok(move(state, 1, { type: 'pass' }));
  assert.equal(passed.scores[1], -10);
  assert.equal(passed.currentPlayer, 2);
  assert.equal(passed.roundSummary, null);
});

test('legalPlays lists every fitting spot and rotation of each tile', () => {
  const plays = legalPlays(fives, [t(0, 1, 2), t(4, 5, 5)]);
  assert.ok(plays.length > 0);
  for (const play of plays) {
    assert.equal(play.type, 'play');
    if (play.type === 'play') assert.equal(play.tile, t(4, 5, 5));
  }
  assert.equal(legalPlays([], [t(1, 2, 3)]).length, 3);
});

test('going out ends the round with the going-out score', () => {
  const state = game({ hands: { 1: [t(4, 5, 5)], 2: [t(1, 1, 1)], 3: [t(2, 2, 3)] }, scores: { 1: 10, 2: 20, 3: 30 } });
  const done = ok(playAnywhere(state, 1, t(4, 5, 5)));
  // 14 for the tile, then 25 plus 3 and 7 left in the other hands
  assert.deepEqual(done.scores, { 1: 10 + 14 + 25 + 10, 2: 20, 3: 30 });
  assert.deepEqual(done.roundSummary, {
    roundNumber: 1, winner: 1, blocked: false, points: { 1: 35, 2: 0, 3: 0 }, sumsLeft: { 1: 0, 2: 3, 3: 7 }, acknowledged: []
  });
  assert.equal(done.currentPlayer, null);
  assert.equal(done.isGameOver, false);
  assert.equal(done.lastMove?.type === 'play' && done.lastMove.wentOut, true);
  assert.deepEqual(move(done, 1, { type: 'draw' }), { error: 'Not your turn' });
});

test('a blocked round ends when the pool is empty and nobody can play', () => {
  // Alice draws the last tile, which does not fit, and nobody holds a tile that does
  const state = game({ pool: [t(0, 0, 1)] });
  const blocked = ok(move(state, 1, { type: 'draw' }));
  // Sums left: Alice 3 + 0 + 1 = 4, Bob 3, Cara 6; Bob is lowest and scores 1 + 3
  assert.deepEqual(blocked.roundSummary, {
    roundNumber: 1, winner: 2, blocked: true, points: { 1: 0, 2: 4, 3: 0 }, sumsLeft: { 1: 4, 2: 3, 3: 6 }, acknowledged: []
  });
  assert.deepEqual(blocked.scores, { 1: -5, 2: 4, 3: 0 });
});

test('the next round waits for Continue from every connected player, and the opening rule applies again', () => {
  const done = ok(playAnywhere(game({ hands: { 1: [t(4, 5, 5)], 2: [t(1, 1, 1)], 3: [t(2, 2, 3)] } }), 1, t(4, 5, 5)));
  let state = ok(act(done, 1, { type: 'acknowledgeRound' }));
  state = ok(act(state, 2, { type: 'acknowledgeRound' }));
  assert.ok(state.roundSummary);
  assert.deepEqual(waitingOn(state), [3]);
  state = ok(act(state, 3, { type: 'acknowledgeRound' }, seeded(5)));
  assert.equal(state.roundSummary, null);
  assert.equal(state.roundNumber, 2);
  assert.deepEqual(state.board, []);
  for (const seat of [1, 2, 3]) assert.equal(state.hands[seat].length, 7);
  const opening = openingTile(state.hands);
  assert.equal(state.leadTile, opening.tile);
  assert.equal(state.currentPlayer, opening.seat);
  assert.equal(state.scores[1], done.scores[1]);

  // A disconnected player is not waited for
  let partly = ok(act(done, 1, { type: 'acknowledgeRound' }));
  partly = ok(act(partly, 2, { type: 'acknowledgeRound' }));
  assert.equal(disconnectPlayer(tritiles, partly, 3, seeded(9)).roundNumber, 2);
});

test('the target is checked only at round end; highest total wins, equal totals share place 1', () => {
  // Bob is past 400 mid-round, and the game goes on
  const passing = game({ pool: [], hands: { 1: [t(0, 1, 2)], 2: [t(4, 5, 5)], 3: [t(2, 2, 2)] }, scores: { 1: 0, 2: 450, 3: 0 } });
  assert.equal(ok(move(passing, 1, { type: 'pass' })).isGameOver, false);

  // Alice goes out for 14 + 25 + 1 = 40, reaching 430
  const ending = (bob: number, alice = 390) => ok(playAnywhere(game({
    hands: { 1: [t(4, 5, 5)], 2: [t(0, 0, 0)], 3: [t(0, 0, 1)] }, scores: { 1: alice, 2: bob, 3: 0 }
  }), 1, t(4, 5, 5)));
  const shared = ending(430);
  assert.equal(shared.scores[1], 430);
  assert.equal(shared.isGameOver, true);
  assert.deepEqual(shared.winners, [1, 2]);
  assert.deepEqual(finalStandings(shared).map(({ seat, place }) => [seat, place]), [[1, 1], [2, 1], [3, 2]]);

  const bobWins = ending(440);
  assert.deepEqual(bobWins.winners, [2]);
  assert.equal(finalStandings(bobWins)[0].seat, 2);

  const short = ending(0, 300);
  assert.equal(short.isGameOver, false);
});

test('the bridge bonus follows the house rule', () => {
  // 4-4-4 touches the far point of the cell right of 5-5-5, so 4-5-5 laid there as 5-4-5 completes a bridge
  const board: Board = [...fives, { tile: t(4, 4, 4), cell: { x: 1, y: 0, up: false }, corners: [4, 4, 4] }];
  const state = game({ board, hands: { 1: [t(4, 5, 5), t(0, 0, 0)], 2: [t(1, 1, 1)], 3: [t(2, 2, 2)] } });
  const play = { type: 'play', tile: t(4, 5, 5), cell: { x: 0, y: 0, up: false }, corners: [5, 4, 5] };
  assert.equal(ok(move(state, 1, play)).scores[1], 14 + 40);
  const off = { host: 1, values: { hexagon: false, bridge: false, targetScore: 400 }, maxPlayers: null, agreed: [1, 2, 3], revision: 1 };
  assert.equal(ok(move({ ...state, houseRules: off }, 1, play)).scores[1], 14);
});

test('undo reshuffles the pool', () => {
  const state = game({ pool: [1, 2, 3, 4, 5, 6, 7, 8] });
  const undone = tritiles.onUndo?.(state, seeded(4)) ?? assert.fail('Tri-Tiles has onUndo');
  assert.deepEqual([...undone.pool].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.notDeepEqual(undone.pool, state.pool);
  assert.deepEqual(undone.hands, state.hands);
});

test('a dismissed player\'s tiles return to the pool, and with one player left they win', () => {
  const state = game({ currentPlayer: 2 });
  const gone = removePlayer(tritiles, state, 2, seeded(1));
  assert.equal(gone.currentPlayer, 3);
  assert.equal(gone.hands[2], undefined);
  assert.deepEqual([...gone.pool].sort(), [...state.pool, t(1, 1, 1)].sort());

  // Bob leaves after two draws: Cara's turn starts with no draws
  const drawing = game({ currentPlayer: 2, drawsThisTurn: 2, lastMove: { type: 'draw', playerNumber: 2, penalty: 5 } });
  assert.equal(removePlayer(tritiles, drawing, 2, seeded(1)).drawsThisTurn, 0);

  const two = removePlayer(tritiles, game({ activePlayers: [1, 2] }), 2, seeded(1));
  assert.equal(two.isGameOver, true);
  assert.deepEqual(two.winners, [1]);
});

test('a dismissal can leave the round blocked, and it ends', () => {
  const state = game({ pool: [], hands: { 1: [t(0, 1, 2)], 2: [t(4, 5, 5)], 3: [t(2, 2, 2)] } });
  // Bob held the only tile that fits; it goes to the pool, so Alice can draw it
  const gone = removePlayer(tritiles, state, 2, seeded(1));
  assert.equal(gone.roundSummary, null);
  assert.deepEqual(gone.pool, [t(4, 5, 5)]);
  // With Bob's hand empty nothing reaches the pool, and nobody left can play
  const blocked = removePlayer(tritiles, { ...state, hands: { ...state.hands, 2: [] } }, 2, seeded(1));
  assert.equal(blocked.roundSummary?.blocked, true);
  assert.equal(blocked.roundSummary?.winner, 1);
  assert.equal('2' in (blocked.roundSummary?.points ?? {}), false);
});

test('a dismissed leader who held the lead tile hands the opening to the tile now highest', () => {
  const state = game({
    board: [], leadTile: t(5, 5, 5), currentPlayer: 2,
    hands: { 1: [t(4, 4, 4)], 2: [t(5, 5, 5)], 3: [t(3, 4, 5)] }
  });
  const gone = removePlayer(tritiles, state, 2, seeded(1));
  assert.equal(gone.leadTile, t(4, 4, 4));
  assert.equal(gone.currentPlayer, 1);
});

test('the table view hides hands and the pool', () => {
  const state = lobby(3, seeded(11));
  const table = toPublicState(state, false, null);
  assert.deepEqual(table.hand, []);
  assert.equal(table.poolCount, 56 - 21);
  for (const key of ['hands', 'pool']) assert.equal(key in table, false);
  const view = toPublicState(state, false, 2);
  assert.deepEqual(view.hand, state.hands[2]);
  assert.deepEqual(view.handCounts, { 1: 7, 2: 7, 3: 7 });
});
