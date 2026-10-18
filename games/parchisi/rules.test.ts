import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE_BONUS, HOME, HOME_BONUS, NEST, TRACK_LENGTH, createGameState, entryIndex, getLegalMoves, isSafe } from './rules.ts';
import { parchisi } from './index.ts';
import { addPlayer, removePlayer } from '../../shared/seating.ts';
import type { DieChoice, GameState, Progress, Random, Result, Seat } from './types.ts';

const NAMES: Record<Seat, string> = { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' };
const IN_NEST: Progress[] = [NEST, NEST, NEST, NEST];

// A random that rolls the given die faces in order, then 1s
function rolls(...faces: number[]): Random {
  let index = 0;
  return () => ((faces[index++] ?? 1) - 0.5) / 6;
}

// A game in progress: `current` holds the given dice
function playing({ pawns, dice, bonuses = [], current = 1, doublesRolled = 0 }: {
  pawns: Record<Seat, Progress[]>;
  dice: number[];
  bonuses?: number[];
  current?: Seat;
  doublesRolled?: number;
}): GameState {
  const seats = Object.keys(pawns).map(Number);
  return {
    ...createGameState('g1'),
    started: true,
    activePlayers: seats,
    playerNames: Object.fromEntries(seats.map(seat => [seat, NAMES[seat]])),
    currentPlayer: current,
    roller: current,
    pawns,
    dice: dice.map(value => ({ value, used: false })),
    bonuses,
    doublesRolled
  };
}

// The progress of `seat`'s pawn standing on track square `index`
function onSquare(seat: Seat, index: number): Progress {
  return (index - entryIndex(seat) + TRACK_LENGTH) % TRACK_LENGTH;
}

function move(state: GameState, seat: Seat, pawn: number, die: DieChoice, random: Random = rolls()): GameState {
  const result = parchisi.applyMove(state, seat, { type: 'move', pawn, die }, random);
  return ok(result);
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function lobby(names: string[], random: Random): GameState {
  let state = parchisi.createGameState('g1');
  for (const name of names) {
    const result = addPlayer(parchisi, state, name, random);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

test('opposite sides for two players and twelve safe squares', () => {
  assert.equal(Math.abs(entryIndex(1) - entryIndex(2)), TRACK_LENGTH / 2);
  assert.equal(Array.from({ length: TRACK_LENGTH }, (_, index) => index).filter(isSafe).length, 12);
});

test('the first player rolls once two players are seated', () => {
  const alone = lobby(['Alice'], rolls(5, 2));
  assert.deepEqual(alone.dice, []);
  assert.deepEqual(alone.pawns, { 1: IN_NEST });

  const state = lobby(['Alice', 'Bob'], rolls(5, 2));
  assert.deepEqual(state.dice, [{ value: 5, used: false }, { value: 2, used: false }]);
  assert.equal(state.currentPlayer, 1);
  assert.match(state.gameStatus, /Alice rolled 5 and 2$/);
});

test('a roll without a move passes the turn with a message', () => {
  const state = lobby(['Alice', 'Bob'], rolls(1, 2, 5, 3));
  assert.equal(state.currentPlayer, 2);
  assert.match(state.gameStatus, /Alice rolled 1 and 2 and cannot move\. Bob rolled 5 and 3$/);
});

test('a 5 on one die enters a pawn and the other die stays to use', () => {
  const state = playing({ pawns: { 1: IN_NEST, 2: IN_NEST }, dice: [5, 2] });
  assert.equal(getLegalMoves(state, 1).length, 4);
  const next = move(state, 1, 0, 0);
  assert.deepEqual(next.pawns[1], [0, NEST, NEST, NEST]);
  assert.deepEqual(next.dice, [{ value: 5, used: true }, { value: 2, used: false }]);
  assert.equal(next.currentPlayer, 1);
  assert.equal(next.gameStatus, 'Alice entered a pawn');
});

test('dice summing to 5 enter a pawn together', () => {
  const state = playing({ pawns: { 1: IN_NEST, 2: IN_NEST }, dice: [2, 3] });
  assert.deepEqual(getLegalMoves(state, 1).map(option => option.die), ['sum', 'sum', 'sum', 'sum']);
  const next = move(state, 1, 2, 'sum', rolls(5, 1));
  assert.deepEqual(next.pawns[1], [NEST, NEST, 0, NEST]);
  assert.equal(next.currentPlayer, 2);
  assert.deepEqual(next.dice, [{ value: 5, used: false }, { value: 1, used: false }]);
});

test('without a 5 nobody leaves the nest', () => {
  const state = playing({ pawns: { 1: IN_NEST, 2: IN_NEST }, dice: [1, 6], bonuses: [HOME_BONUS] });
  assert.deepEqual(getLegalMoves(state, 1), []);
});

test('the turn passes once both dice are used', () => {
  const state = playing({ pawns: { 1: [0, NEST, NEST, NEST], 2: IN_NEST }, dice: [1, 2] });
  const half = move(state, 1, 0, 0);
  assert.equal(half.currentPlayer, 1);
  const done = move(half, 1, 0, 1, rolls(4, 6, 5, 1));
  assert.equal(done.pawns[1][0], 3);
  assert.equal(done.currentPlayer, 1);
  assert.equal(done.gameStatus, 'Alice moved a pawn 2 squares. Bob rolled 4 and 6 and cannot move. Alice rolled 5 and 1');
});

test('landing on an opponent captures it and earns a 20 square bonus', () => {
  const state = playing({ pawns: { 1: [0, NEST, NEST, NEST], 2: [onSquare(2, 8), NEST, NEST, NEST] }, dice: [3, 1] });
  const next = move(state, 1, 0, 0);
  assert.equal(next.pawns[2][0], NEST);
  assert.deepEqual(next.bonuses, [CAPTURE_BONUS]);
  assert.deepEqual(next.lastMove?.captured, { seat: 2, pawn: 0 });
  assert.equal(next.gameStatus, "Alice moved a pawn 3 squares and captured Bob's pawn (+20)");

  const bonus = move(next, 1, 0, 'bonus');
  assert.equal(bonus.pawns[1][0], 23);
  assert.deepEqual(bonus.bonuses, []);
});

test('pawns share a safe square instead of capturing', () => {
  const state = playing({ pawns: { 1: [9, NEST, NEST, NEST], 2: [onSquare(2, 17), NEST, NEST, NEST] }, dice: [3, 1] });
  assert.equal(isSafe(17), true);
  const next = move(state, 1, 0, 0);
  assert.equal(next.pawns[1][0], 12);
  assert.equal(next.pawns[2][0], onSquare(2, 17));
  assert.deepEqual(next.bonuses, []);
});

test('entering captures an opponent on the safe entry square', () => {
  const state = playing({ pawns: { 1: IN_NEST, 2: [onSquare(2, entryIndex(1)), NEST, NEST, NEST] }, dice: [5, 1] });
  const next = move(state, 1, 0, 0);
  assert.equal(next.pawns[2][0], NEST);
  assert.deepEqual(next.bonuses, [CAPTURE_BONUS]);
});

test('a blockade cannot be passed or landed on, even by its owner', () => {
  const blockade = onSquare(2, 8);
  const state = playing({ pawns: { 1: [1, 0, NEST, NEST], 2: [blockade, blockade, NEST, NEST] }, dice: [4, 2] });
  const options = getLegalMoves(state, 1).map(({ pawn, die }) => `${pawn}:${die}`);
  assert.deepEqual(options, ['1:1']);

  const own = playing({ pawns: { 1: [2, 2, 0, NEST], 2: IN_NEST }, dice: [4, 4] });
  assert.deepEqual(getLegalMoves(own, 1).map(option => option.pawn), [0, 1, 0, 1]);
});

test('home takes an exact roll and earns a 10 square bonus', () => {
  const state = playing({ pawns: { 1: [68, 10, NEST, NEST], 2: IN_NEST }, dice: [4, 3] });
  assert.equal(getLegalMoves(state, 1).some(option => option.pawn === 0 && option.die === 0), false);
  const next = move(state, 1, 0, 1);
  assert.equal(next.pawns[1][0], HOME);
  assert.deepEqual(next.bonuses, [HOME_BONUS]);
  assert.equal(next.gameStatus, 'Alice moved a pawn home (+10)');
});

test('a double rolls again after the turn', () => {
  const state = playing({ pawns: { 1: [0, NEST, NEST, NEST], 2: IN_NEST }, dice: [2, 2], doublesRolled: 1 });
  const next = move(move(state, 1, 0, 0), 1, 0, 1, rolls(6, 1));
  assert.equal(next.currentPlayer, 1);
  assert.deepEqual(next.dice.map(die => die.value), [6, 1]);
  assert.equal(next.doublesRolled, 0);
});

test('a third double in a row sends the furthest pawn on the track back to the nest', () => {
  const state = playing({ pawns: { 1: [10, 30, 66, NEST], 2: IN_NEST }, dice: [1, 1], doublesRolled: 2 });
  const next = move(move(state, 1, 0, 0), 1, 0, 1, rolls(3, 3, 5, 1));
  assert.deepEqual(next.pawns[1], [12, NEST, 66, NEST]);
  assert.equal(next.currentPlayer, 2);
  assert.match(next.gameStatus, /Alice rolled a third double in a row and lost the turn and a pawn to the nest\. Bob rolled 5 and 1$/);
});

test('the fourth pawn home wins', () => {
  const state = playing({ pawns: { 1: [HOME, HOME, HOME, 70], 2: IN_NEST }, dice: [1, 2] });
  const next = move(state, 1, 3, 0);
  assert.equal(next.isGameOver, true);
  assert.deepEqual(next.winners, [1]);
  assert.equal(next.currentPlayer, null);
  assert.equal(next.gameStatus, 'Alice wins!');
});

test('malformed and illegal moves are rejected', () => {
  const state = playing({ pawns: { 1: IN_NEST, 2: IN_NEST }, dice: [5, 2] });
  assert.deepEqual(parchisi.applyMove(state, 1, 'move', rolls()), { error: 'Unknown move type' });
  assert.deepEqual(parchisi.applyMove(state, 1, { type: 'move', pawn: '0', die: 0 }, rolls()), { error: 'Invalid move' });
  assert.deepEqual(parchisi.applyMove(state, 1, { type: 'move', pawn: 4, die: 0 }, rolls()), { error: 'Invalid move' });
  assert.deepEqual(parchisi.applyMove(state, 1, { type: 'move', pawn: 0, die: 1 }, rolls()), { error: 'Invalid move' });
});

test('a player who leaves loses their pawns, and the next player rolls if it was their turn', () => {
  const state = playing({ pawns: { 1: [3, NEST, NEST, NEST], 2: [5, NEST, NEST, NEST], 3: IN_NEST }, dice: [6, 4], current: 2 });
  const next = removePlayer(parchisi, state, 2, rolls(5, 1));
  assert.deepEqual(Object.keys(next.pawns), ['1', '3']);
  assert.equal(next.currentPlayer, 3);
  assert.deepEqual(next.dice.map(die => die.value), [5, 1]);

  const other = removePlayer(parchisi, state, 3, rolls(5, 1));
  assert.equal(other.currentPlayer, 2);
  assert.deepEqual(other.dice.map(die => die.value), [6, 4]);
});
