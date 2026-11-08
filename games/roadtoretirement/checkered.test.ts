import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseGameState } from '../../shared/seating.ts';
import { withRules } from '../../server/testing.ts';
import { HAPPY_OLD_AGE, INFANCY, SQUARES, cellOf, isLight, legalMoves, type Square } from './checkered.ts';
import { checkeredLeft, checkeredMove, checkeredStandings, startCheckered } from './checkeredRules.ts';
import type { Cell, CheckeredState, GameState, Move, Random, Seat } from './types.ts';

const NAMES: Record<Seat, string> = { 1: 'Alice', 2: 'Bob', 3: 'Cara' };

// A random that spins the given teetotum numbers in order, then 1s
const spins = (...values: number[]): Random => {
  let i = 0;
  return () => ((values[i++] ?? 1) - 0.5) / 6;
};

// The game is not registered yet, so tests build the table directly rather than through `dealt`
function game(seats = 2): GameState {
  const activePlayers = Array.from({ length: seats }, (_, i) => i + 1);
  return startCheckered({
    ...baseGameState('g'), started: true, activePlayers, currentPlayer: 1,
    playerNames: Object.fromEntries(activePlayers.map(seat => [seat, NAMES[seat]])),
    houseRules: withRules({ board: 'checkered' }), board: 'checkered', road: null, checkered: null, spin: null, lastMove: null
  });
}

const board = (state: GameState): CheckeredState => state.checkered!;

// `seat` stands at `at` with `points`, waiting to pick one of `options`
function choosing(state: GameState, seat: Seat, options: Cell[], points = 0, at: Cell = INFANCY): GameState {
  const c = board(state);
  return {
    ...state, currentPlayer: seat,
    checkered: { ...c, phase: 'choose', options, pieces: { ...c.pieces, [seat]: at }, points: { ...c.points, [seat]: points } },
    lastMove: { type: 'spin', playerNumber: seat, spin: 4, events: ['spun 4'] }
  };
}

function play(state: GameState, seat: Seat, move: Move, random: Random = spins()): GameState {
  const result = checkeredMove(state, seat, move, random);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const stepTo = (state: GameState, name: string, points = 0, random: Random = spins()): GameState =>
  play(choosing(state, 1, [cellOf(name)], points), 1, { type: 'step', to: cellOf(name) }, random);

const sorted = (cells: Cell[]): string[] => cells.map(c => `${c.row},${c.col}`).sort();

test('Infancy is bottom left, Happy Old Age top right, both light', () => {
  assert.deepEqual(INFANCY, { row: 7, col: 0 });
  assert.deepEqual(HAPPY_OLD_AGE, { row: 0, col: 7 });
  assert.ok(isLight(INFANCY) && isLight(HAPPY_OLD_AGE));
  assert.equal(SQUARES['7,0'].name, 'Infancy');
  assert.ok(SQUARES['0,7'].goal);
  for (const key of Object.keys(SQUARES)) {
    const [row, col] = key.split(',').map(Number);
    assert.ok(isLight({ row, col }), key);
  }
  // Every send lands on a named square
  for (const square of Object.values(SQUARES)) if (square.sendTo) cellOf(square.sendTo);
});

test("the spec's named squares and points", () => {
  const byName = (name: string): Square => SQUARES[sorted([cellOf(name)])[0]];
  for (const name of ['Bravery', 'Honor', 'School', 'College', 'Honesty', 'Happiness', 'Industry', 'Wealth', 'Gambling', 'Ruin',
    'Idleness', 'Disgrace', 'Crime', 'Prison', 'Success', 'Fat Office', 'Congress', 'Despair']) assert.ok(byName(name), name);
  const sends: [string, string][] = [['Bravery', 'Honor'], ['School', 'College'], ['Honesty', 'Happiness'], ['Industry', 'Wealth'],
    ['Gambling', 'Ruin'], ['Idleness', 'Disgrace'], ['Crime', 'Prison']];
  for (const [from, to] of sends) assert.equal(byName(from).sendTo, to, from);
  assert.equal(byName('Wealth').points, 10);
  for (const name of ['Honor', 'Happiness', 'College', 'Success', 'Fat Office', 'Congress']) assert.equal(byName(name).points, 5, name);
  assert.equal(byName('Prison').loseTurn, true);
  assert.equal(byName('Despair').despair, true);
  assert.ok(!Object.values(SQUARES).some(square => square.name === 'Suicide'));
});

test('teetotum moves', () => {
  const from = { row: 4, col: 3 };
  const expected: Record<number, string[]> = {
    1: ['2,3', '6,3'],
    2: ['4,1', '4,5'],
    3: ['3,2', '3,4', '5,2', '5,4'],
    4: ['0,3', '2,3', '6,3'],
    5: ['4,1', '4,5', '4,7'],
    6: ['2,1', '2,5', '3,2', '3,4', '5,2', '5,4', '6,1', '6,5']
  };
  for (let spin = 1; spin <= 6; spin++) {
    const moves = legalMoves(from, spin);
    assert.deepEqual(sorted(moves), expected[spin].sort(), `spin ${spin}`);
    assert.ok(moves.every(isLight));
  }
  // From the corner only the squares on the board count
  assert.deepEqual(sorted(legalMoves(INFANCY, 1)), ['5,0']);
});

test('no legal move passes the turn', () => {
  // Every light square of the 8 x 8 board has a move for every spin, so a piece off the board stands in for one that has none
  let state = game();
  state = { ...state, checkered: { ...board(state), pieces: { ...board(state).pieces, 1: { row: -9, col: -9 } } } };
  state = play(state, 1, { type: 'spin' }, spins(2));
  assert.equal(state.gameStatus, 'Alice spun 2 and cannot move');
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.spin, 2);
  assert.equal(board(state).phase, 'spin');
});

test('one legal move is made at once, several wait for a choice', () => {
  let state = play(game(), 1, { type: 'spin' }, spins(1));
  assert.deepEqual(board(state).pieces[1], { row: 5, col: 0 });
  assert.equal(state.currentPlayer, 2);
  state = play(state, 2, { type: 'spin' }, spins(4));
  assert.equal(board(state).phase, 'choose');
  assert.deepEqual(sorted(board(state).options), ['3,0', '5,0']);
  assert.equal(state.currentPlayer, 2);
  assert.ok('error' in checkeredMove(state, 2, { type: 'step', to: { row: 7, col: 2 } }, spins()));
  assert.ok('error' in checkeredMove(state, 2, { type: 'spin' }, spins()));
  state = play(state, 2, { type: 'step', to: { row: 3, col: 0 } });
  assert.equal(board(state).points[2], 5); // Congress
  assert.equal(state.currentPlayer, 1);
});

test('a send scores its target', () => {
  const state = stepTo(game(), 'Bravery');
  assert.deepEqual(board(state).pieces[1], cellOf('Honor'));
  assert.equal(board(state).points[1], 5);
  assert.equal(state.lastMove?.events.join(', '), 'landed on Bravery, went on to Honor');
});

test('a send does not chain', () => {
  // No send target on the real board has a send of its own, so Honor gets one for this test
  const squares = SQUARES as Record<string, Square>;
  const key = sorted([cellOf('Honor')])[0];
  const honor = squares[key];
  squares[key] = { ...honor, sendTo: 'Wealth' };
  try {
    const state = stepTo(game(), 'Bravery');
    assert.deepEqual(board(state).pieces[1], cellOf('Honor'));
    assert.equal(board(state).points[1], 5);
  } finally {
    squares[key] = honor;
  }
});

test('Speculation spins again: 3 or 6 to Wealth, anything else to Ruin', () => {
  for (const spun of [3, 6]) {
    const state = stepTo(game(), 'Speculation', 0, spins(spun));
    assert.deepEqual(board(state).pieces[1], cellOf('Wealth'));
    assert.equal(board(state).points[1], 10);
    assert.ok(state.lastMove!.events.includes(`spun ${spun} on Speculation`));
  }
  for (const spun of [1, 2, 4, 5]) {
    const state = stepTo(game(), 'Speculation', 0, spins(spun));
    assert.deepEqual(board(state).pieces[1], cellOf('Ruin'));
    assert.equal(board(state).points[1], 0);
  }
});

test('Prison loses the next turn', () => {
  let state = stepTo(game(), 'Crime');
  assert.deepEqual(board(state).pieces[1], cellOf('Prison'));
  assert.deepEqual(board(state).skipNext, [1]);
  state = play(state, 2, { type: 'spin' }, spins(1));
  assert.equal(state.currentPlayer, 1);
  const at = board(state).pieces[1];
  state = play(state, 1, { type: 'spin' }, spins(1));
  assert.equal(state.gameStatus, 'Alice lost this turn');
  assert.deepEqual(board(state).pieces[1], at);
  assert.deepEqual(board(state).skipNext, []);
  assert.equal(state.currentPlayer, 2);
});

test('Despair goes back to Infancy with no points', () => {
  const state = stepTo(game(), 'Despair', 35);
  assert.deepEqual(board(state).pieces[1], INFANCY);
  assert.equal(board(state).points[1], 0);
});

test('Happy Old Age wins at 100 counting its 50, and short of it play goes on', () => {
  let state = stepTo(game(), 'Happy Old Age', 50);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.currentPlayer, null);
  assert.equal(state.gameStatus, 'Alice reached Happy Old Age with 100 points');
  assert.deepEqual(checkeredStandings(state).map(s => [s.seat, s.place, s.score]), [[1, 1, '100 points'], [2, 2, '0 points']]);

  state = stepTo(game(), 'Happy Old Age', 40);
  assert.equal(state.isGameOver, false);
  assert.equal(board(state).points[1], 40);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.gameStatus, 'Alice reached Happy Old Age short of 100 points');
});

test('landing on Infancy again does nothing', () => {
  const state = stepTo(game(), 'Infancy', 15);
  assert.deepEqual(board(state).pieces[1], INFANCY);
  assert.equal(board(state).points[1], 15);
});

const dismissed = (state: GameState, seat: Seat): GameState => {
  const activePlayers = state.activePlayers.filter(s => s !== seat);
  const currentPlayer = state.currentPlayer === seat ? activePlayers.find(s => s > seat) ?? activePlayers[0] : state.currentPlayer;
  return checkeredLeft({ ...state, activePlayers, currentPlayer }, seat);
};

test('dismissing the player who must choose starts the next turn', () => {
  const state = choosing(game(3), 1, [{ row: 5, col: 0 }, { row: 3, col: 0 }]);
  let left = dismissed(state, 1);
  assert.equal(board(left).pieces[1], undefined);
  assert.equal(left.currentPlayer, 2);
  assert.equal(board(left).phase, 'spin');
  assert.deepEqual(board(left).options, []);

  // Someone else leaves: Alice's choice stays
  left = dismissed(state, 3);
  assert.equal(left.currentPlayer, 1);
  assert.equal(board(left).phase, 'choose');
  assert.equal(board(left).options.length, 2);
});
