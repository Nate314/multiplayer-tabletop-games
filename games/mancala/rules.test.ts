import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankOf, initialBoard, isPlayablePit, pitsOf, playPit } from './rules.ts';
import { mancala } from './index.ts';
import { addPlayer, removePlayer, applyMove } from '../../shared/seating.ts';
import type { Board, GameState, Seat } from './types.ts';

// Seat 1's pits 0-5 and bank, then seat 2's pits 7-12 and bank, as stone counts.
// Every stone has the color of the side it is on.
function board(one: number[], oneBank: number, two: number[], twoBank: number): Board {
  const holes = (counts: number[], seat: Seat) => counts.map(count => Array<Seat>(count).fill(seat));
  return [...holes([...one, oneBank], 1), ...holes([...two, twoBank], 2)];
}

function counts(holes: Board): number[] {
  return holes.map(hole => hole.length);
}

// Where each lap's stones were dropped
function landings(laps: { to: number }[][]): number[][] {
  return laps.map(drops => drops.map(({ to }) => to));
}

function seated(result: ReturnType<typeof addPlayer<GameState>>) {
  if ('error' in result) assert.fail(result.error);
  return result;
}

function lobby(...names: string[]): GameState {
  let state = mancala.createGameState('g1');
  for (const name of names) state = seated(addPlayer(mancala, state, name)).state;
  return state;
}

function play(state: GameState, seat: Seat, pit: number): GameState {
  const result = applyMove(mancala, state, seat, { pit });
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('the board starts with four stones of their owner\'s color in each pit and empty banks', () => {
  assert.deepEqual(initialBoard(), board([4, 4, 4, 4, 4, 4], 0, [4, 4, 4, 4, 4, 4], 0));
  assert.deepEqual(pitsOf(1), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(pitsOf(2), [7, 8, 9, 10, 11, 12]);
  assert.equal(bankOf(1), 6);
  assert.equal(bankOf(2), 13);
});

test('the picked-up stones go one per hole, skip the opponent bank and stop in an empty pit', () => {
  const first = playPit(board([4, 0, 0, 0, 0, 0], 0, [4, 4, 4, 4, 4, 4], 0), 1, 0);
  assert.deepEqual(counts(first.board), counts(board([0, 1, 1, 1, 1, 0], 0, [4, 4, 4, 4, 4, 4], 0)));
  assert.equal(first.end, 4);
  assert.deepEqual(first.laps, [[{ from: 0, to: 1 }, { from: 0, to: 2 }, { from: 0, to: 3 }, { from: 0, to: 4 }]]);

  const long = playPit(board([0, 0, 0, 0, 0, 10], 0, [0, 0, 0, 0, 0, 0], 0), 1, 5);
  assert.deepEqual(landings(long.laps), [[6, 7, 8, 9, 10, 11, 12, 0, 1, 2]]);
  assert.equal(long.end, 2);

  const forTwo = playPit(board([0, 0, 0, 0, 0, 0], 0, [0, 0, 0, 0, 0, 9], 0), 2, 12);
  assert.deepEqual(landings(forTwo.laps), [[13, 0, 1, 2, 3, 4, 5, 7, 8]]);
  assert.equal(forTwo.end, 8);
});

test('thirteen stones go all the way around and stop in the pit they emptied', () => {
  const { board: after, end, laps } = playPit(board([13, 0, 0, 0, 0, 0], 0, [1, 0, 0, 0, 0, 0], 0), 1, 0);
  assert.equal(end, 0);
  assert.equal(laps.length, 1);
  assert.deepEqual(counts(after), counts(board([1, 1, 1, 1, 1, 1], 1, [2, 1, 1, 1, 1, 1], 0)));
});

test('a last stone in a pit that had stones picks that pit up and keeps going', () => {
  const start = { ...lobby('A', 'B'), board: board([2, 0, 1, 0, 0, 0], 0, [1, 1, 1, 1, 1, 1], 0) };
  const turn = playPit(start.board, 1, 0);
  assert.deepEqual(turn.laps, [[{ from: 0, to: 1 }, { from: 0, to: 2 }], [{ from: 2, to: 3 }, { from: 2, to: 4 }]]);

  const state = play(start, 1, 0);
  assert.deepEqual(state.board, board([0, 1, 0, 1, 1, 0], 0, [1, 1, 1, 1, 1, 1], 0));
  assert.deepEqual(state.lastMove, { playerNumber: 1, pit: 0, end: 4, pickedUp: 2, laps: 2, extraTurn: false });
  assert.equal(state.gameStatus, 'A picked up 2 stones and kept going once, ending in an empty pit');
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.started, true);
  assert.deepEqual(addPlayer(mancala, state, 'C'), { error: 'Game already in progress' });
});

test('the chain keeps going from every full pit it ends in', () => {
  const start = { ...lobby('A', 'B'), board: board([1, 1, 0, 1, 0, 0], 0, [1, 1, 1, 1, 1, 1], 0) };
  assert.deepEqual(landings(playPit(start.board, 1, 0).laps), [[1], [2, 3], [4, 5]]);
  const state = play(start, 1, 0);
  assert.deepEqual(counts(state.board), counts(board([0, 0, 1, 0, 1, 1], 0, [1, 1, 1, 1, 1, 1], 0)));
  assert.equal(state.lastMove?.laps, 3);
  assert.equal(state.lastMove?.end, 5);
  assert.equal(state.gameStatus, 'A picked up 1 stone and kept going 2 times, ending in an empty pit');
});

test('a chain that ends in your own bank gives an extra turn', () => {
  const start = { ...lobby('A', 'B'), board: board([2, 0, 3, 0, 0, 0], 0, [1, 1, 1, 1, 1, 1], 0) };
  const state = play(start, 1, 0);
  assert.deepEqual(counts(state.board), counts(board([0, 1, 0, 1, 1, 1], 1, [1, 1, 1, 1, 1, 1], 0)));
  assert.equal(state.lastMove?.end, 6);
  assert.equal(state.lastMove?.extraTurn, true);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.gameStatus, 'A picked up 2 stones and kept going once, ending in A\'s bank for an extra turn');
});

test('the last stone in your own bank on the first lap gives an extra turn too', () => {
  const state = play(lobby('A', 'B'), 1, 2);
  assert.equal(state.lastMove?.end, 6);
  assert.equal(state.lastMove?.laps, 1);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.gameStatus, 'A picked up 4 stones, ending in A\'s bank for an extra turn');
  const second = play({ ...state, currentPlayer: 2 }, 2, 9);
  assert.equal(second.lastMove?.end, 13);
  assert.equal(second.currentPlayer, 2);
});

test('the turn ends in an empty pit on either side', () => {
  const ours = play({ ...lobby('A', 'B'), board: board([4, 0, 0, 0, 0, 0], 0, [4, 4, 4, 4, 4, 4], 0) }, 1, 0);
  assert.equal(ours.gameStatus, 'A picked up 4 stones, ending in an empty pit');
  assert.equal(ours.currentPlayer, 2);

  const theirs = play({ ...lobby('A', 'B'), board: board([1, 0, 0, 0, 0, 2], 0, [0, 1, 1, 1, 1, 1], 0) }, 1, 5);
  assert.equal(theirs.lastMove?.end, 7);
  assert.deepEqual(theirs.board[7], [1]);
  assert.equal(theirs.currentPlayer, 2);
});

test('the chain keeps going from a pit on the opponent\'s side, and stones keep their color', () => {
  const start = { ...lobby('A', 'B'), board: board([1, 0, 0, 0, 0, 2], 0, [2, 0, 0, 0, 0, 1], 0) };
  assert.deepEqual(playPit(start.board, 1, 5).laps.map(drops => drops[0].from), [5, 7]);
  const state = play(start, 1, 5);
  assert.deepEqual(counts(state.board), counts(board([1, 0, 0, 0, 0, 0], 1, [0, 1, 1, 1, 0, 1], 0)));
  assert.deepEqual([state.board[8], state.board[9], state.board[10]], [[2], [2], [1]]);
  assert.equal(state.lastMove?.end, 10);
});

test('a relay from the opponent\'s last pit skips their bank', () => {
  const turn = playPit(board([1, 0, 0, 0, 0, 7], 0, [1, 1, 1, 1, 1, 2], 0), 1, 5);
  assert.deepEqual(landings(turn.laps), [[6, 7, 8, 9, 10, 11, 12], [0, 1, 2]]);
  assert.deepEqual(counts(turn.board), counts(board([2, 1, 1, 0, 0, 0], 1, [2, 2, 2, 2, 2, 0], 0)));
});

test('a long opening chain keeps every stone and their colors', () => {
  const { board: after, laps } = playPit(initialBoard(), 1, 5);
  assert.deepEqual(landings(laps), [[6, 7, 8, 9], [10, 11, 12, 0, 1], [2, 3, 4, 5, 6]]);
  assert.deepEqual(after[6], [1, 1]);
  assert.deepEqual(after[7], [2, 2, 2, 2, 1]);
  assert.deepEqual(after[0], [1, 1, 1, 1, 2]);
  assert.deepEqual(after[9], []);
});

test('players take seats in order and a third is refused', () => {
  const state = lobby('A', 'B');
  assert.deepEqual(state.activePlayers, [1, 2]);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.gameStatus, 'B joined (2/2 players)');
  assert.deepEqual(addPlayer(mancala, state, 'C'), { error: 'Game is full' });
});

test('rejects malformed and illegal moves', () => {
  const state = lobby('A', 'B');
  assert.deepEqual(applyMove(mancala, state, 2, { pit: 7 }), { error: 'Not your turn' });
  assert.deepEqual(applyMove(mancala, lobby('A'), 1, { pit: 0 }), { error: 'Waiting for more players' });
  for (const move of [{ pit: 7 }, { pit: 6 }, { pit: -1 }, { pit: '0' }, { pit: 0.5 }, {}, null, 'pit', []]) {
    assert.deepEqual(applyMove(mancala, state, 1, move), { error: 'Invalid move' });
  }
  const empty = { ...state, board: board([0, 4, 4, 4, 4, 4], 0, [4, 4, 4, 4, 4, 4], 0) };
  assert.deepEqual(applyMove(mancala, empty, 1, { pit: 0 }), { error: 'Invalid move' });
});

test('when a side empties, the rest go to their owner\'s bank and the most stones win', () => {
  const start = { ...lobby('A', 'B'), board: board([0, 0, 0, 0, 0, 1], 20, [1, 2, 0, 0, 0, 0], 24) };
  const turn = playPit(start.board, 1, 5);
  assert.deepEqual(turn.sweep, [{ from: 7, to: 13 }, { from: 8, to: 13 }, { from: 8, to: 13 }]);
  const state = play(start, 1, 5);
  assert.deepEqual(counts(state.board), counts(board([0, 0, 0, 0, 0, 0], 21, [0, 0, 0, 0, 0, 0], 27)));
  assert.equal(state.isGameOver, true);
  assert.equal(state.currentPlayer, null);
  assert.equal(state.lastMove?.extraTurn, false);
  assert.deepEqual(state.winners, [2]);
  assert.equal(state.gameStatus, 'B wins 27 to 21!');
  assert.deepEqual(applyMove(mancala, state, 1, { pit: 0 }), { error: 'The game is over' });
});

test('equal banks are a draw', () => {
  const start = { ...lobby('A', 'B'), board: board([0, 0, 0, 0, 0, 1], 23, [0, 0, 0, 0, 0, 0], 24) };
  const state = play(start, 1, 5);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, []);
  assert.equal(state.gameStatus, 'Draw, 24 stones each');
});

test('the last connected player wins', () => {
  const state = removePlayer(mancala, play(lobby('A', 'B'), 1, 0), 1);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [2]);
});

// Relay sowing could in principle go on and on, so this plays many random games and checks every chain ends.
// rules.ts explains why it always does.
test('random games always end and keep all 48 stones', t => {
  const random = mulberry32(11);
  let longest = 0;
  for (let game = 0; game < 1000; game++) {
    let state = lobby('A', 'B');
    for (let moves = 0; !state.isGameOver; moves++) {
      assert.ok(moves < 1000, 'the game should end');
      const seat = state.currentPlayer;
      if (seat === null) assert.fail('nobody to move');
      const pits = pitsOf(seat).filter(pit => isPlayablePit(state.board, seat, pit));
      state = play(state, seat, pits[Math.floor(random() * pits.length)]);
      assert.equal(state.board.flat().length, 48);
      longest = Math.max(longest, state.lastMove?.laps ?? 0);
    }
  }
  t.diagnostic(`longest chain: ${longest} laps`);
  assert.ok(longest > 10);
});
