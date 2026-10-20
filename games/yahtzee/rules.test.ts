import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, allowedCategories, createGameState, scoreFor, totals } from './rules.ts';
import { yahtzee } from './index.ts';
import { addPlayer, applyMove, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import type { Random, Result } from '../../shared/types.ts';
import type { Category, GameState, Sheet } from './types.ts';

// Each value is one die face, read in order and then repeated
function dice(...faces: number[]): Random {
  let next = 0;
  return () => (faces[next++ % faces.length] - 0.5) / 6;
}

const NONE = [false, false, false, false, false];
const ROLL = { type: 'roll', hold: NONE };

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function lobby(...names: string[]): GameState {
  let state = createGameState('g');
  for (const name of names) {
    const result = addPlayer(yahtzee, state, name, dice(1));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

// A game under way with Alice (seat 1) to play, holding the given dice
function turn(sheet: Sheet, faces: number[], rollsLeft = 2): GameState {
  const base = lobby('Alice', 'Bob');
  return { ...base, started: true, dice: faces, held: NONE, rollsLeft, sheets: { 1: sheet, 2: {} } };
}

const play = (state: GameState, seat: number, move: unknown, random: Random = dice(1)) => applyMove(yahtzee, state, seat, move, random);
const score = (state: GameState, seat: number, category: Category) => ok(play(state, seat, { type: 'score', category }));
const roll = (state: GameState, hold: boolean[], ...faces: number[]) => ok(play(state, state.currentPlayer ?? 0, { type: 'roll', hold }, dice(...faces)));

// Every box filled except chance
const nearlyFull = (points: number): Sheet => Object.fromEntries(CATEGORIES.filter(c => c !== 'chance').map(c => [c, points]));

test('setup gives every seat an empty sheet and three rolls', () => {
  const state = lobby('Alice', 'Bob', 'Cara');
  assert.deepEqual(state.sheets, { 1: {}, 2: {}, 3: {} });
  assert.deepEqual(state.yahtzeeBonuses, { 1: 0, 2: 0, 3: 0 });
  assert.equal(state.rollsLeft, 3);
  assert.deepEqual(state.dice, []);
  assert.equal(state.currentPlayer, 1);
});

test('three rolls at most', () => {
  let state = lobby('Alice', 'Bob');
  assert.deepEqual(play(state, 1, { type: 'score', category: 'chance' }), { error: 'Roll the dice first' });
  state = roll(state, NONE, 1, 2, 3, 4, 5);
  assert.deepEqual(state.dice, [1, 2, 3, 4, 5]);
  assert.equal(state.rollsLeft, 2);
  state = roll(state, [true, true, false, false, false], 6, 6, 6);
  assert.deepEqual(state.dice, [1, 2, 6, 6, 6]);
  assert.deepEqual(state.held, [true, true, false, false, false]);
  state = roll(state, [true, true, true, true, false], 4);
  assert.deepEqual(state.dice, [1, 2, 6, 6, 4]);
  assert.equal(state.rollsLeft, 0);
  assert.deepEqual(play(state, 1, ROLL), { error: 'No rolls left: score a box' });
});

test('the first roll ignores hold flags', () => {
  const state = roll(lobby('Alice', 'Bob'), [true, true, true, true, false], 2, 3, 4, 5, 6);
  assert.deepEqual(state.dice, [2, 3, 4, 5, 6]);
  assert.deepEqual(state.held, NONE);
});

// [category, dice that score, points, dice that score nothing or undefined]
const CASES: [Category, number[], number, number[]?][] = [
  ['ones', [1, 1, 3, 4, 1], 3],
  ['twos', [2, 2, 3, 4, 5], 4],
  ['threes', [3, 3, 3, 3, 5], 12],
  ['fours', [4, 1, 2, 3, 5], 4],
  ['fives', [5, 5, 5, 5, 5], 25],
  ['sixes', [6, 6, 1, 2, 3], 12],
  ['threeKind', [3, 3, 3, 4, 6], 19, [1, 1, 2, 2, 3]],
  ['fourKind', [2, 2, 2, 2, 6], 14, [3, 3, 3, 2, 2]],
  ['fullHouse', [2, 2, 5, 5, 5], 25, [2, 2, 3, 5, 5]],
  ['smallStraight', [1, 2, 3, 4, 6], 30, [1, 2, 3, 5, 6]],
  ['largeStraight', [2, 3, 4, 5, 6], 40, [1, 2, 3, 4, 6]],
  ['yahtzee', [4, 4, 4, 4, 4], 50, [4, 4, 4, 4, 3]],
  ['chance', [1, 2, 3, 4, 6], 16]
];

for (const [category, faces, points, miss] of CASES) {
  test(`each category scores as the article says: ${category}`, () => {
    assert.equal(scoreFor(faces, category, {}), points);
    if (miss) assert.equal(scoreFor(miss, category, {}), 0);
    assert.equal(score(turn({}, faces), 1, category).sheets[1][category], points);
  });
}

test('straights may carry a spare die and five of a kind is no full house', () => {
  assert.equal(scoreFor([4, 4, 4, 4, 4], 'fullHouse', {}), 0);
  assert.equal(scoreFor([1, 2, 3, 4, 4], 'smallStraight', {}), 30);
  assert.equal(scoreFor([1, 2, 3, 4, 4], 'largeStraight', {}), 0);
  assert.equal(scoreFor([2, 3, 4, 5, 5], 'smallStraight', {}), 30);
});

test('the upper bonus is 35 at 63 or more', () => {
  const upper = (sixes: number): Sheet => ({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes });
  assert.deepEqual(totals(upper(18)), { upper: 63, upperBonus: 35, lower: 0, yahtzeeBonus: 0, total: 98 });
  assert.equal(totals(upper(12)).upperBonus, 0);
  assert.equal(totals(upper(12)).total, 57);
  assert.equal(totals(upper(24)).upperBonus, 35);
  // Scoring the last upper box earns the bonus
  const state = score(turn({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15 }, [6, 6, 6, 1, 2]), 1, 'sixes');
  assert.equal(totals(state.sheets[1]).total, 98);
});

test('a second Yahtzee gives 100 and follows the Joker rule', () => {
  const sixes = [6, 6, 6, 6, 6];
  // Joker: the matching upper box first, and the 100 bonus
  assert.deepEqual(allowedCategories(sixes, { yahtzee: 50 }), ['sixes']);
  const state = score(turn({ yahtzee: 50 }, sixes), 1, 'sixes');
  assert.equal(state.sheets[1].sixes, 30);
  assert.equal(state.yahtzeeBonuses[1], 1);
  assert.equal(totals(state.sheets[1], 1).yahtzeeBonus, 100);
  assert.equal(totals(state.sheets[1], 1).total, 50 + 30 + 100);
  assert.deepEqual(play(turn({ yahtzee: 50 }, sixes), 1, { type: 'score', category: 'chance' }), { error: 'Joker rule: score the Yahtzee in Sixes' });

  // Matching upper box filled: any open lower box, with full house and straights at full value
  const lowerOpen: Sheet = { yahtzee: 50, sixes: 12 };
  assert.deepEqual(allowedCategories(sixes, lowerOpen), ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'chance']);
  assert.equal(scoreFor(sixes, 'fullHouse', lowerOpen), 25);
  assert.equal(scoreFor(sixes, 'smallStraight', lowerOpen), 30);
  assert.equal(scoreFor(sixes, 'largeStraight', lowerOpen), 40);
  assert.deepEqual(play(turn(lowerOpen, sixes), 1, { type: 'score', category: 'ones' }), { error: 'Joker rule: score the Yahtzee in a lower box' });
  const straight = score(turn(lowerOpen, sixes), 1, 'largeStraight');
  assert.equal(straight.sheets[1].largeStraight, 40);
  assert.equal(straight.yahtzeeBonuses[1], 1);

  // Whole lower section filled: a zero in an open upper box
  const lowerFull: Sheet = { yahtzee: 50, sixes: 12, threeKind: 20, fourKind: 20, fullHouse: 25, smallStraight: 30, largeStraight: 40, chance: 20 };
  assert.deepEqual(allowedCategories(sixes, lowerFull), ['ones', 'twos', 'threes', 'fours', 'fives']);
  assert.equal(scoreFor(sixes, 'ones', lowerFull), 0);

  // A scratched Yahtzee box pays no bonus, but the Joker rule still applies
  assert.equal(score(turn({ yahtzee: 0 }, sixes), 1, 'sixes').yahtzeeBonuses[1], 0);
  assert.deepEqual(allowedCategories(sixes, { yahtzee: 0 }), ['sixes']);

  // The first Yahtzee is no Joker: any open box, and no bonus
  assert.deepEqual(allowedCategories(sixes, {}), CATEGORIES);
  assert.equal(score(turn({}, sixes), 1, 'yahtzee').yahtzeeBonuses[1], 0);
});

test('a category can be scored only once, zero allowed', () => {
  const scratched = score(turn({}, [1, 2, 3, 4, 6]), 1, 'yahtzee');
  assert.equal(scratched.sheets[1].yahtzee, 0);
  assert.equal(scratched.currentPlayer, 2);
  assert.deepEqual(scratched.dice, []);
  assert.equal(scratched.rollsLeft, 3);

  const again = turn({ chance: 16 }, [1, 2, 3, 4, 6]);
  const copy = structuredClone(again);
  assert.deepEqual(play(again, 1, { type: 'score', category: 'chance' }), { error: 'That box is already filled' });
  assert.deepEqual(again, copy);
});

test('invalid moves', () => {
  const state = turn({}, [1, 2, 3, 4, 6]);
  const copy = structuredClone(state);
  for (const move of [null, 'roll', 7, {}, { type: 'shout' }, { type: 'roll' }, { type: 'roll', hold: 'yes' }, { type: 'roll', hold: [true] },
    { type: 'roll', hold: [1, 0, 0, 0, 0] }, { type: 'score' }, { type: 'score', category: 'bogus' }, { type: 'score', category: 42 }]) {
    assert.ok('error' in play(state, 1, move), JSON.stringify(move));
  }
  assert.deepEqual(play(state, 1, { type: 'roll', hold: [true, true, true, true, true] }), { error: 'Leave at least one die to roll' });
  assert.deepEqual(play(state, 2, ROLL), { error: 'Not your turn' });
  assert.deepEqual(state, copy);
});

test('the game ends after 13 rounds and the highest total wins, ties share', () => {
  const finishing = (...names: string[]): GameState => {
    const state = lobby(...names);
    return { ...state, started: true, dice: [1, 1, 1, 1, 1], rollsLeft: 1, held: NONE, sheets: Object.fromEntries(state.activePlayers.map(seat => [seat, nearlyFull(0)])) };
  };
  // Alice 5, Bob 6, Cara 10: the last box of the 13th round ends the game
  let state = score({ ...finishing('Alice', 'Bob', 'Cara'), dice: [1, 1, 1, 1, 1] }, 1, 'chance');
  assert.equal(state.isGameOver, false);
  state = score({ ...state, dice: [1, 1, 1, 1, 2] }, 2, 'chance');
  assert.equal(state.isGameOver, false);
  assert.equal(state.currentPlayer, 3);
  state = score({ ...state, dice: [2, 2, 2, 2, 2] }, 3, 'chance');
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [3]);
  assert.equal(state.currentPlayer, null);
  assert.deepEqual(play(state, 1, ROLL), { error: 'The game is over' });

  // Equal totals share the win
  let tie = score(finishing('Alice', 'Bob'), 1, 'chance');
  tie = score({ ...tie, dice: [1, 1, 1, 1, 1] }, 2, 'chance');
  assert.deepEqual(tie.winners, [1, 2]);
});

test('the turn passes in seat order and a new turn starts with three rolls', () => {
  const state = score(roll(lobby('Alice', 'Bob'), NONE, 1, 2, 3, 4, 5), 1, 'chance');
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.rollsLeft, 3);
  assert.deepEqual(state.held, []);
  assert.deepEqual(state.lastMove, { type: 'score', playerNumber: 1, category: 'chance', points: 15, bonus: false, dice: [1, 2, 3, 4, 5] });
});

test('dismissed player mid-turn', () => {
  // Bob has rolled, then disconnects and is dismissed: Cara plays on with a fresh turn
  let state = score(roll(lobby('Alice', 'Bob', 'Cara'), NONE, 1, 2, 3, 4, 5), 1, 'chance');
  state = roll(state, NONE, 6, 6, 6, 6, 5);
  assert.equal(state.rollsLeft, 2);
  const dismissed = removePlayer(yahtzee, disconnectPlayer(yahtzee, state, 2), 2);
  assert.equal(dismissed.currentPlayer, 3);
  assert.deepEqual(dismissed.dice, []);
  assert.equal(dismissed.rollsLeft, 3);
  assert.equal(dismissed.isGameOver, false);

  // If everyone left has filled the sheet, the dismissal ends the game and the dismissed sheet does not count
  const done: GameState = { ...lobby('Alice', 'Bob', 'Cara'), started: true, currentPlayer: 2, sheets: {
    1: { ...nearlyFull(1), chance: 1 }, 2: nearlyFull(0), 3: { ...nearlyFull(2), chance: 2 }
  } };
  const left = removePlayer(yahtzee, done, 2);
  assert.equal(left.isGameOver, true);
  assert.deepEqual(left.winners, [3]);
});

test('table view hides hands', () => {
  // Nothing is hidden: every viewer sees the same dice and sheets, and no seat key
  let state = lobby('Alice', 'Bob');
  const random = dice(3, 1, 4, 1, 5, 2, 6, 5);
  for (let moves = 0; moves < 26; moves++) {
    const seat = state.currentPlayer ?? assert.fail('nobody to play');
    const views = [null, 1, 2].map(viewer => JSON.stringify(yahtzee.toPublicState(state, false, viewer)));
    assert.equal(new Set(views).size, 1);
    assert.equal(views[0].includes('seatKeys'), false);
    state = state.dice.length === 0 ? ok(play(state, seat, ROLL, random)) : score(state, seat, allowedCategories(state.dice, state.sheets[seat])[0]);
  }
});
