import { createGameState, finalStandings } from './rules.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MANCALA_RULES } from './options.ts';
import { bankOf, initialBoard, pitsOf, playPit as sow, playablePits } from './rules.ts';
import { withRules } from '../../server/testing.ts';
import { mancala } from './index.ts';
import { addPlayer, removePlayer, applyMove } from '../../shared/seating.ts';
import type { Board, GameState, Seat } from './types.ts';

// Seat 1's pits 0-5 and bank, then seat 2's pits 7-12 and bank, as stone counts.
// Every stone has the color of the side it is on.
function board(one: number[], oneBank: number, two: number[], twoBank: number): Board {
  const holes = (counts: number[], seat: Seat) => counts.map(count => Array<Seat>(count).fill(seat));
  return [...holes([...one, oneBank], 1), ...holes([...two, twoBank], 2)];
}

const STANDARD = { otherSide: true, avalanche: true };
const KALAH = { otherSide: true, avalanche: false };
const playPit = (holes: Board, seat: Seat, pit: number, rules = STANDARD) => sow(holes, seat, pit, rules);
const withHouseRules = (state: GameState, values: { otherSide: boolean; avalanche: boolean }): GameState =>
  ({ ...state, houseRules: withRules(values) });

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
  const start = withHouseRules({ ...lobby('A', 'B'), board: board([0, 0, 0, 0, 0, 1], 20, [1, 2, 0, 0, 0, 0], 24) }, { otherSide: false, avalanche: true });
  const turn = playPit(start.board, 1, 5, { otherSide: false, avalanche: true });
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
  const start = withHouseRules({ ...lobby('A', 'B'), board: board([0, 0, 0, 0, 0, 1], 23, [0, 0, 0, 0, 0, 0], 24) }, { otherSide: false, avalanche: true });
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

// Relay sowing and play from the other side could in principle go on and on, so this plays many seeded random games
// with each mix of the two rules and checks every one ends, with all 48 stones kept
const MIXES: [boolean, boolean][] = [[true, true], [true, false], [false, true], [false, false]];
for (const [otherSide, avalanche] of MIXES) {
  const name = `otherSide ${otherSide ? 'on' : 'off'}, avalanche ${avalanche ? 'on' : 'off'}`;
  test(`${name}: 500 seeded random games all end${otherSide ? ', every pit empty' : ''}`, t => {
    const random = mulberry32(11 + Number(otherSide) * 2 + Number(avalanche));
    let longest = 0;
    let slowest = 0;
    for (let game = 0; game < 500; game++) {
      let state = withHouseRules(lobby('A', 'B'), { otherSide, avalanche });
      let moves = 0;
      for (; !state.isGameOver; moves++) {
        assert.ok(moves < 5000, `game ${game} should end`);
        const seat = state.currentPlayer;
        if (seat === null) assert.fail('nobody to move');
        const pits = playablePits(state.board, seat, otherSide);
        assert.ok(pits.length > 0 || !otherSide, 'the player to move has a pit');
        if (pits.length === 0) break;
        state = play(state, seat, pits[Math.floor(random() * pits.length)]);
        assert.equal(state.board.flat().length, 48);
        longest = Math.max(longest, state.lastMove?.laps ?? 0);
      }
      assert.ok(state.isGameOver, `game ${game} ended`);
      slowest = Math.max(slowest, moves);
      if (otherSide) assert.ok([...pitsOf(1), ...pitsOf(2)].every(pit => state.board[pit].length === 0), 'every pit is empty');
    }
    t.diagnostic(`longest chain: ${longest} laps, longest game: ${slowest} moves`);
    if (avalanche) assert.ok(longest > 10);
  });
}

test('with your side empty you may play a pit on the other side', () => {
  const start = withHouseRules({ ...lobby('A', 'B'), board: board([0, 0, 0, 0, 0, 0], 3, [2, 0, 1, 0, 0, 4], 5) }, STANDARD);
  assert.deepEqual(playablePits(start.board, 1, true), [7, 9, 12]);
  // Pit 12's 4 stones skip B's bank 13 and drop into A's pits 0 to 3
  assert.deepEqual(landings(playPit(start.board, 1, 12).laps), [[0, 1, 2, 3]]);
  const state = play(start, 1, 12);
  assert.equal(state.lastMove?.fromOpponent, true);
  assert.deepEqual({ pit: state.lastMove?.pit, end: state.lastMove?.end }, { pit: 12, end: 3 });
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.gameStatus, "A picked up 4 stones from B's side, ending in an empty pit");

  // Passing A's own bank puts a stone in it
  const passing = playPit(board([0, 0, 0, 0, 0, 0], 0, [3, 0, 0, 0, 0, 0], 0), 1, 7);
  assert.deepEqual(landings(passing.laps), [[8, 9, 10]]);
  const toBank = playPit(board([0, 0, 0, 0, 0, 0], 0, [0, 0, 0, 0, 0, 13], 0), 1, 12);
  assert.deepEqual(landings(toBank.laps), [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]]);
  assert.equal(toBank.board[6].length, 1);
  assert.equal(toBank.board[13].length, 0);
});

test('a pit on the other side is refused while your side has stones', () => {
  const start = withHouseRules({ ...lobby('A', 'B'), board: board([0, 0, 0, 0, 0, 1], 3, [2, 0, 1, 0, 0, 4], 5) }, STANDARD);
  assert.deepEqual(applyMove(mancala, start, 1, { pit: 7 }), { error: 'Invalid move' });
  assert.deepEqual(playablePits(start.board, 1, true), [5]);
  const emptied = withHouseRules({ ...start, board: board([0, 0, 0, 0, 0, 0], 3, [2, 0, 1, 0, 0, 4], 5) }, { otherSide: false, avalanche: true });
  assert.deepEqual(playablePits(emptied.board, 1, false), []);
  assert.deepEqual(applyMove(mancala, emptied, 1, { pit: 7 }), { error: 'Invalid move' });
  // An empty pit on the other side is refused too
  assert.deepEqual(applyMove(mancala, { ...emptied, houseRules: withRules(STANDARD) }, 1, { pit: 8 }), { error: 'Invalid move' });
});

test('with play from the other side on the game ends only when every pit is empty', () => {
  // A's row is empty after the move but B still has stones: the game goes on and nothing is swept
  const start = withHouseRules({ ...lobby('A', 'B'), board: board([0, 0, 0, 0, 0, 2], 20, [0, 2, 0, 0, 0, 0], 24) }, STANDARD);
  const state = play(start, 1, 5);
  assert.equal(state.isGameOver, false);
  assert.deepEqual(counts(state.board), counts(board([0, 0, 0, 0, 0, 0], 21, [1, 2, 0, 0, 0, 0], 24)));
  assert.equal(state.currentPlayer, 2);
  // A's last stone in A's bank leaves B's stones on the board: A moves again, from B's side
  const bank = play(withHouseRules({ ...lobby('A', 'B'), board: board([0, 0, 0, 0, 0, 1], 20, [0, 0, 0, 0, 0, 3], 24) }, STANDARD), 1, 5);
  assert.equal(bank.isGameOver, false);
  assert.equal(bank.currentPlayer, 1);
  assert.deepEqual(playablePits(bank.board, 1, true), [12]);
  // With the very last stone in A's bank every pit is empty
  const last = play(withHouseRules({ ...lobby('A', 'B'), board: board([0, 0, 0, 0, 0, 1], 20, [0, 0, 0, 0, 0, 0], 24) }, STANDARD), 1, 5);
  assert.equal(last.isGameOver, true);
  assert.deepEqual(counts(last.board), counts(board([0, 0, 0, 0, 0, 0], 21, [0, 0, 0, 0, 0, 0], 24)));
  assert.deepEqual(last.winners, [2]);
});

test('with it off the game ends when a row is empty and the rows are swept', () => {
  const start = withHouseRules({ ...lobby('A', 'B'), board: board([0, 0, 0, 0, 0, 1], 20, [1, 2, 0, 0, 0, 0], 24) }, { otherSide: false, avalanche: true });
  const state = play(start, 1, 5);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(counts(state.board), counts(board([0, 0, 0, 0, 0, 0], 21, [0, 0, 0, 0, 0, 0], 27)));
});

test('Kalah captures the last stone and the opposite pit', () => {
  const start = withHouseRules({ ...lobby('A', 'B'), board: board([1, 0, 0, 0, 0, 2], 0, [0, 0, 0, 3, 4, 0], 0) }, KALAH);
  // Pit 0's stone lands in empty pit 1, opposite pit 11 holds 4
  const turn = playPit(start.board, 1, 0, KALAH);
  assert.deepEqual(turn.capture, [{ from: 1, to: 6 }, { from: 11, to: 6 }, { from: 11, to: 6 }, { from: 11, to: 6 }, { from: 11, to: 6 }]);
  const state = play(start, 1, 0);
  assert.deepEqual(counts(state.board), counts(board([0, 0, 0, 0, 0, 2], 5, [0, 0, 0, 3, 0, 0], 0)));
  assert.equal(state.lastMove?.captured, 5);
  assert.equal(state.gameStatus, 'A picked up 1 stone, ending in an empty pit and capturing 5 stones');
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.board[6].filter(stone => stone === 2).length, 4);
});

test('Kalah does not capture opposite an empty pit', () => {
  const start = withHouseRules({ ...lobby('A', 'B'), board: board([1, 0, 0, 0, 0, 2], 0, [0, 0, 0, 3, 0, 0], 0) }, KALAH);
  assert.deepEqual(playPit(start.board, 1, 0, KALAH).capture, []);
  const state = play(start, 1, 0);
  assert.deepEqual(counts(state.board), counts(board([0, 1, 0, 0, 0, 2], 0, [0, 0, 0, 3, 0, 0], 0)));
  assert.equal(state.lastMove?.captured, undefined);
  // A last stone in an empty pit on the other side never captures either
  assert.deepEqual(playPit(board([0, 0, 0, 0, 0, 2], 0, [0, 0, 0, 0, 0, 0], 0), 1, 5, KALAH).capture, []);
});

test('Kalah has no relays', () => {
  const start = withHouseRules({ ...lobby('A', 'B'), board: board([2, 0, 1, 0, 0, 0], 0, [1, 1, 1, 1, 1, 1], 0) }, KALAH);
  const turn = playPit(start.board, 1, 0, KALAH);
  assert.equal(turn.laps.length, 1);
  assert.equal(turn.end, 2);
  const state = play(start, 1, 0);
  assert.deepEqual(counts(state.board), counts(board([0, 1, 2, 0, 0, 0], 0, [1, 1, 1, 1, 1, 1], 0)));
  assert.equal(state.currentPlayer, 2);
});

test('Kalah ending in a pit that had stones says so, and a last stone in your bank is still another turn', () => {
  const start = withHouseRules({ ...lobby('A', 'B'), board: board([1, 1, 0, 0, 0, 0], 0, [1, 1, 1, 1, 1, 1], 0) }, KALAH);
  assert.equal(play(start, 1, 0).gameStatus, 'A picked up 1 stone, ending in a pit with stones');
  const state = play(withHouseRules(lobby('A', 'B'), KALAH), 1, 2);
  assert.equal(state.currentPlayer, 1);
});

test('the rules are declared, both on by default', () => {
  assert.deepEqual(MANCALA_RULES.map(rule => [rule.id, rule.kind, rule.standard]), [['otherSide', 'toggle', true], ['avalanche', 'toggle', true]]);
  assert.deepEqual(MANCALA_RULES.map(rule => rule.label), [
    'When your side is empty, play from the other side', 'Avalanche (off plays Kalah, with captures)'
  ]);
  assert.equal(mancala.info.houseRules, MANCALA_RULES);
});

test('finalStandings ranks by the stones in each bank', () => {
  const board: Board = Array.from({ length: 14 }, () => []);
  board[bankOf(1)] = Array<number>(20).fill(1);
  board[bankOf(2)] = Array<number>(28).fill(2);
  const state: GameState = { ...createGameState('t'), activePlayers: [1, 2], isGameOver: true, winners: [2], board };
  assert.deepEqual(finalStandings(state), [{ seat: 2, place: 1, score: '28 stones' }, { seat: 1, place: 2, score: '20 stones' }]);
});
