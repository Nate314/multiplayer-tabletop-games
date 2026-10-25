import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPTURE_BONUS, HOME, HOME_BONUS, NEST, TRACK_LENGTH, createGameState, entryIndex, getLegalMoves, isSafe, nextPlayer
} from './rules.ts';
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
  const result = parchisi.applyMove(state, seat, { type: 'move', pawn, die }, random, 0);
  return ok(result);
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// Each legal move as pawn:die
function options(state: GameState, seat: Seat): string[] {
  return getLegalMoves(state, seat).map(({ pawn, die }) => `${pawn}:${die}`);
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

test('with four players turns pass to the left, around the board', () => {
  const players = { activePlayers: [1, 2, 3, 4] };
  assert.deepEqual([1, 4, 2, 3].map(seat => nextPlayer(players, seat)), [4, 2, 3, 1]);

  const state = playing({ pawns: { 1: [0, NEST, NEST, NEST], 2: IN_NEST, 3: IN_NEST, 4: IN_NEST }, dice: [1, 2] });
  const next = move(state, 1, 0, 'total', rolls(1, 2, 1, 2, 1, 2, 6, 1));
  assert.equal(next.gameStatus, 'Alice moved a pawn 3 squares. Dan rolled 1 and 2 and cannot move. ' +
    'Bob rolled 1 and 2 and cannot move. Cara rolled 1 and 2 and cannot move. Alice rolled 6 and 1');

  const left = removePlayer(parchisi, state, 1, rolls(5, 1));
  assert.equal(left.currentPlayer, 4);
});

test('the lowest roll-off goes first, and players tied for lowest roll again', () => {
  const alone = lobby(['Alice'], rolls(5, 2));
  assert.deepEqual(alone.dice, []);
  assert.deepEqual(alone.pawns, { 1: IN_NEST });

  const state = lobby(['Alice', 'Bob'], rolls(4, 3, 5, 2));
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.dice, [{ value: 5, used: false }, { value: 2, used: false }]);
  assert.match(state.gameStatus, /Lowest roll goes first: Alice 4, Bob 3\. Bob goes first\. Bob rolled 5 and 2$/);

  const three = parchisi.resetLobby({ ...state, activePlayers: [1, 2, 3], playerNames: NAMES, gameStatus: 'Cara joined' },
    rolls(4, 2, 2, 5, 3, 5, 1));
  assert.equal(three.currentPlayer, 3);
  assert.equal(three.gameStatus,
    'Cara joined. Lowest roll goes first: Alice 4, Bob 2, Cara 2; tie: Bob 5, Cara 3. Cara goes first. Cara rolled 5 and 1');
});

test('a roll without a move passes the turn with a message', () => {
  const state = lobby(['Alice', 'Bob'], rolls(2, 1, 1, 2, 5, 3));
  assert.equal(state.currentPlayer, 1);
  assert.match(state.gameStatus, /Bob rolled 1 and 2 and cannot move\. Alice rolled 5 and 3$/);
});

test('a 5 on one die enters a pawn and the other die stays to use', () => {
  const state = playing({ pawns: { 1: IN_NEST, 2: IN_NEST }, dice: [5, 2] });
  assert.deepEqual(options(state, 1), ['0:0', '1:0', '2:0', '3:0']);
  const next = move(state, 1, 0, 0);
  assert.deepEqual(next.pawns[1], [0, NEST, NEST, NEST]);
  assert.deepEqual(next.dice, [{ value: 5, used: true }, { value: 2, used: false }]);
  assert.equal(next.currentPlayer, 1);
  assert.equal(next.gameStatus, 'Alice entered a pawn');
});

test('dice totalling 5 enter a pawn together', () => {
  const state = playing({ pawns: { 1: IN_NEST, 2: IN_NEST }, dice: [2, 3] });
  assert.deepEqual(options(state, 1), ['0:total', '1:total', '2:total', '3:total']);
  const next = move(state, 1, 2, 'total', rolls(5, 1));
  assert.deepEqual(next.pawns[1], [NEST, NEST, 0, NEST]);
  assert.equal(next.currentPlayer, 2);
  assert.deepEqual(next.dice, [{ value: 5, used: false }, { value: 1, used: false }]);
});

test('without a 5 nobody leaves the nest', () => {
  const state = playing({ pawns: { 1: IN_NEST, 2: IN_NEST }, dice: [1, 6], bonuses: [HOME_BONUS] });
  assert.deepEqual(getLegalMoves(state, 1), []);
});

test('one pawn can move by each die or by the total', () => {
  const state = playing({ pawns: { 1: [0, NEST, NEST, NEST], 2: IN_NEST }, dice: [2, 4] });
  assert.deepEqual(getLegalMoves(state, 1).map(({ die, to }) => `${die}:${to}`), ['0:2', '1:4', 'total:6']);
  const next = move(state, 1, 0, 'total', rolls(6, 1, 6, 1));
  assert.equal(next.pawns[1][0], 6);
  assert.equal(next.gameStatus, 'Alice moved a pawn 6 squares. Bob rolled 6 and 1 and cannot move. Alice rolled 6 and 1');
});

test('the total moves one die at a time, capturing along the way, and must be legal as a whole', () => {
  const capture = playing({ pawns: { 1: [0, NEST, NEST, NEST], 2: [onSquare(2, entryIndex(1) + 2), NEST, NEST, NEST] }, dice: [2, 4] });
  const next = move(capture, 1, 0, 'total');
  assert.equal(next.pawns[1][0], 6);
  assert.equal(next.pawns[2][0], NEST);
  assert.deepEqual(next.bonuses, [CAPTURE_BONUS]);
  assert.equal(next.gameStatus, "Alice moved a pawn 6 squares and captured Bob's pawn (+20)");

  const blockade = onSquare(2, entryIndex(1) + 3);
  const blocked = playing({ pawns: { 1: [0, NEST, NEST, NEST], 2: [blockade, blockade, NEST, NEST] }, dice: [2, 4] });
  assert.deepEqual(options(blocked, 1), ['0:0']);
});

test('a move may not strand the other die, and when only one die can be used it is the larger', () => {
  const blockade = onSquare(2, entryIndex(1) + 7);
  const both = playing({ pawns: { 1: [0, 66, NEST, NEST], 2: [blockade, blockade, NEST, NEST] }, dice: [6, 2] });
  assert.deepEqual(options(both, 1), ['0:0', '1:1']);

  const one = playing({ pawns: { 1: [0, NEST, NEST, NEST], 2: [blockade, blockade, NEST, NEST] }, dice: [3, 6] });
  assert.deepEqual(options(one, 1), ['0:1']);
});

test('doubles with every pawn out of the nest add the faces underneath', () => {
  const state = playing({ pawns: { 1: [0, NEST, NEST, NEST], 2: [10, 20, 30, HOME] }, dice: [1, 2] });
  const next = move(state, 1, 0, 'total', rolls(3, 3));
  assert.deepEqual(next.dice.map(die => die.value), [3, 3, 4, 4]);
  assert.match(next.gameStatus, /Bob rolled 3 and 3 with 4 and 4 underneath, doubles, and rolls again if every die is used$/);
  assert.deepEqual(options(next, 2), ['0:0', '1:0', '2:0', '0:2', '1:2', '2:2']);

  const nested = playing({ pawns: { 1: [0, NEST, NEST, NEST], 2: [10, 20, 30, NEST] }, dice: [1, 2] });
  assert.deepEqual(move(nested, 1, 0, 'total', rolls(3, 3)).dice.map(die => die.value), [3, 3]);
});

test('doubles roll again once every die is used', () => {
  const state = playing({ pawns: { 1: [0, NEST, NEST, NEST], 2: IN_NEST }, dice: [2, 2], doublesRolled: 1 });
  const next = move(move(state, 1, 0, 0), 1, 0, 1, rolls(6, 1));
  assert.equal(next.currentPlayer, 1);
  assert.deepEqual(next.dice.map(die => die.value), [6, 1]);
  assert.equal(next.doublesRolled, 0);
});

test('doubles that cannot all be used do not roll again', () => {
  const blockade = onSquare(2, entryIndex(1) + 3);
  const state = playing({ pawns: { 1: [0, NEST, NEST, NEST], 2: [blockade, blockade, NEST, NEST] }, dice: [2, 2] });
  const next = move(state, 1, 0, 0, rolls(6, 1));
  assert.equal(next.currentPlayer, 2);
  assert.deepEqual(next.dice.map(die => die.value), [6, 1]);
});

test('a capture earns a 20 square bonus, taken whole by one pawn after the dice', () => {
  const state = playing({ pawns: { 1: [0, 30, NEST, NEST], 2: [onSquare(2, entryIndex(1) + 3), NEST, NEST, NEST] }, dice: [3, 1] });
  const next = move(state, 1, 0, 0);
  assert.equal(next.pawns[2][0], NEST);
  assert.deepEqual(next.bonuses, [CAPTURE_BONUS]);
  assert.deepEqual(next.lastMove?.captured, [{ seat: 2, pawn: 0 }]);
  assert.equal(next.gameStatus, "Alice moved a pawn 3 squares and captured Bob's pawn (+20)");
  assert.deepEqual(options(next, 1), ['0:1', '1:1']);

  const diced = move(next, 1, 1, 1);
  assert.deepEqual(getLegalMoves(diced, 1).map(({ pawn, die, to }) => `${pawn}:${die}:${to}`), ['0:bonus:23', '1:bonus:51']);
  const bonus = move(diced, 1, 0, 'bonus');
  assert.equal(bonus.pawns[1][0], 23);
  assert.deepEqual(bonus.bonuses, []);
});

test('a bonus no pawn can move is dropped, and the one after it can still be taken', () => {
  // The pawn home earns 10 behind the 20 already owed; from 56, 20 overshoots home but 10 fits
  const state = playing({ pawns: { 1: [55, 68, NEST, NEST], 2: IN_NEST }, dice: [3, 1], bonuses: [CAPTURE_BONUS] });
  const next = move(move(state, 1, 1, 0), 1, 0, 1);
  assert.deepEqual(next.bonuses, [HOME_BONUS]);
  assert.equal(next.currentPlayer, 1);
  assert.equal(move(next, 1, 0, 'bonus').pawns[1][0], 66);
});

test('a safe square held by an opponent cannot be landed on', () => {
  const state = playing({ pawns: { 1: [9, NEST, NEST, NEST], 2: [onSquare(2, 17), NEST, NEST, NEST] }, dice: [3, 1] });
  assert.equal(isSafe(17), true);
  assert.equal(entryIndex(1) + 12, 17);
  assert.deepEqual(getLegalMoves(state, 1).map(({ die, to }) => `${die}:${to}`), ['1:10', 'total:13']);
  const next = move(state, 1, 0, 'total');
  assert.equal(next.pawns[2][0], onSquare(2, 17));
  assert.deepEqual(next.bonuses, []);
});

test('entering captures a single opponent on the safe entry square, but not a blockade', () => {
  const entry = onSquare(2, entryIndex(1));
  const state = playing({ pawns: { 1: IN_NEST, 2: [entry, NEST, NEST, NEST] }, dice: [5, 1] });
  const next = move(state, 1, 0, 0);
  assert.equal(next.pawns[2][0], NEST);
  assert.deepEqual(next.bonuses, [CAPTURE_BONUS]);

  const blocked = playing({ pawns: { 1: IN_NEST, 2: [entry, entry, NEST, NEST] }, dice: [5, 1] });
  assert.deepEqual(getLegalMoves(blocked, 1), []);
});

test('a blockade cannot be passed or landed on, even by its owner', () => {
  const blockade = onSquare(2, 8);
  const state = playing({ pawns: { 1: [1, 0, NEST, NEST], 2: [blockade, blockade, NEST, NEST] }, dice: [4, 2] });
  assert.deepEqual(options(state, 1), ['1:1']);

  const own = playing({ pawns: { 1: [2, 2, 0, NEST], 2: IN_NEST }, dice: [4, 4] });
  assert.deepEqual(options(own, 1), ['0:0', '1:0']);
});

test('blockade pawns do not move forward together on doubles', () => {
  const state = playing({ pawns: { 1: [2, 2, 20, NEST], 2: IN_NEST }, dice: [3, 3] });
  const next = move(state, 1, 0, 0);
  assert.deepEqual(next.splitBlockades, [2]);
  assert.deepEqual(options(next, 1), ['0:1', '2:1']);
});

test('home takes an exact roll and earns a 10 square bonus', () => {
  const state = playing({ pawns: { 1: [68, 10, NEST, NEST], 2: IN_NEST }, dice: [4, 3] });
  assert.equal(getLegalMoves(state, 1).some(option => option.pawn === 0 && option.die === 0), false);
  const next = move(state, 1, 0, 1);
  assert.equal(next.pawns[1][0], HOME);
  assert.deepEqual(next.bonuses, [HOME_BONUS]);
  assert.equal(next.gameStatus, 'Alice moved a pawn home (+10)');
});

test('a third double in a row sends the pawn closest to home back to the nest, even from the home column', () => {
  const state = playing({ pawns: { 1: [10, 30, 66, NEST], 2: IN_NEST }, dice: [1, 1], doublesRolled: 2 });
  const next = move(move(state, 1, 0, 0), 1, 0, 1, rolls(3, 3, 5, 1));
  assert.deepEqual(next.pawns[1], [12, 30, NEST, NEST]);
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
  assert.deepEqual(parchisi.applyMove(state, 1, 'move', rolls(), 0), { error: 'Unknown move type' });
  assert.deepEqual(parchisi.applyMove(state, 1, { type: 'move', pawn: '0', die: 0 }, rolls(), 0), { error: 'Invalid move' });
  assert.deepEqual(parchisi.applyMove(state, 1, { type: 'move', pawn: 4, die: 0 }, rolls(), 0), { error: 'Invalid move' });
  assert.deepEqual(parchisi.applyMove(state, 1, { type: 'move', pawn: 0, die: 1 }, rolls(), 0), { error: 'Invalid move' });
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
