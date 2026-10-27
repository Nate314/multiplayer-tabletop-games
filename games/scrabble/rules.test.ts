import { finalStandings } from './rules.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLANK,
  BOARD_SIZE,
  CENTER,
  drawTiles,
  evaluatePlacement,
  fullBag,
  premiumAt,
  rackValue,
  removeFromRack,
  toPublicState,
  createGameState
} from './rules.ts';
import { scrabble } from './index.ts';
import { withRules } from '../../server/testing.ts';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import type { Board, GameState, Move, Placement, Premium, RackTile, Result, Seat } from './types.ts';

// Always draws the first tile left in the bag, so deals are predictable
const first = () => 0;

function lobby(...names: string[]): GameState {
  let state = createGameState('g1');
  for (const name of names) {
    const result = addPlayer(scrabble, state, name, first);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

// A two-player game with chosen racks and words already on the board
function game(racks: Record<Seat, string>, words: Placement[] = [], bag: RackTile[] = fullBag()): GameState {
  const state = lobby('A', 'B');
  const board = state.board.map(row => [...row]);
  for (const tile of words) board[tile.row][tile.col] = { letter: tile.letter, blank: tile.blank === true };
  const rackOf = (letters: string) => letters.split('');
  return {
    ...state,
    board,
    bag,
    started: words.length > 0,
    racks: Object.fromEntries(Object.entries(racks).map(([seat, letters]) => [seat, rackOf(letters)]))
  };
}

// Tiles spelling `word` from (row, col), across or down
function spell(word: string, row: number, col: number, down = false): Placement[] {
  return word.split('').map((letter, index) => ({
    row: down ? row + index : row,
    col: down ? col : col + index,
    letter
  }));
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function move(state: GameState, seat: Seat, input: Move): Result<GameState> {
  return applyMove(scrabble, state, seat, input, first);
}

function points(board: Board, tiles: Placement[]): number {
  const result = evaluatePlacement(board, tiles);
  if ('error' in result) assert.fail(result.error);
  return result.state.points;
}

const CAT = spell('CAT', CENTER, CENTER - 1);

test('the bag holds the standard 100 tiles', () => {
  const bag = fullBag();
  assert.equal(bag.length, 100);
  assert.equal(bag.filter(tile => tile === BLANK).length, 2);
  assert.equal(bag.filter(tile => tile === 'E').length, 12);
  assert.equal(rackValue(bag), 187);
  assert.equal(rackValue(['Q', 'Z', BLANK]), 20);
});

test('the board has the standard premium squares', () => {
  const counts: Record<string, number> = {};
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const premium = premiumAt(row, col);
      if (premium) counts[premium] = (counts[premium] ?? 0) + 1;
    }
  }
  assert.deepEqual(counts, { TW: 8, DW: 17, TL: 12, DL: 24 });
  const expected: [number, number, Premium][] = [[0, 0, 'TW'], [7, 7, 'DW'], [1, 5, 'TL'], [0, 3, 'DL'], [14, 11, 'DL']];
  for (const [row, col, premium] of expected) assert.equal(premiumAt(row, col), premium);
  assert.equal(premiumAt(7, 6), null);
});

test('drawing takes tiles out of the bag', () => {
  const { drawn, bag } = drawTiles(['A', 'B', 'C'], 2, first);
  assert.deepEqual(drawn, ['A', 'B']);
  assert.deepEqual(bag, ['C']);
  assert.deepEqual(drawTiles(['A'], 7, first), { drawn: ['A'], bag: [] });
});

test('removing from a rack needs every tile', () => {
  assert.deepEqual(removeFromRack(['A', 'B', 'A'], ['A', 'A']), ['B']);
  assert.equal(removeFromRack(['A', 'B'], ['A', 'A']), null);
});

test('everyone seated gets seven tiles, dealt again when the lobby changes', () => {
  const two = lobby('A', 'B');
  assert.equal(two.racks[1].length, 7);
  assert.equal(two.racks[2].length, 7);
  assert.equal(two.bag.length, 86);
  assert.deepEqual(two.scores, { 1: 0, 2: 0 });
  assert.equal(two.currentPlayer, 1);

  const left = removePlayer(scrabble, two, 1, first);
  assert.deepEqual(Object.keys(left.racks), ['2']);
  assert.equal(left.bag.length, 93);
});

test('the first word scores with the center double word', () => {
  const state = ok(move(game({ 1: 'CATXYZE', 2: 'AAAAAAA' }), 1, { type: 'play', tiles: CAT }));
  assert.equal(state.scores[1], 10);
  assert.equal(state.board[CENTER][CENTER]?.letter, 'A');
  assert.equal(state.racks[1].length, 7);
  assert.equal(state.bag.length, 97);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.gameStatus, 'A played CAT for 10 points');
  assert.deepEqual(state.lastMove, {
    type: 'play', playerNumber: 1, tiles: CAT.map(tile => ({ ...tile, blank: false })),
    words: [{ word: 'CAT', points: 10 }], bingo: false, points: 10
  });
});

test('the first word must cover the center and have two letters', () => {
  const state = game({ 1: 'CATXYZE', 2: 'AAAAAAA' });
  assert.deepEqual(move(state, 1, { type: 'play', tiles: spell('CAT', 0, 0) }), { error: 'The first word must cover the center star' });
  assert.deepEqual(move(state, 1, { type: 'play', tiles: spell('C', CENTER, CENTER) }), { error: 'The first word needs at least two letters' });
});

test('tiles go in one unbroken row or column of empty squares', () => {
  const state = game({ 1: 'CATXYZE', 2: 'AAAAAAA' });
  const play = (tiles: Placement[]) => move(state, 1, { type: 'play', tiles });
  assert.deepEqual(play([{ row: 7, col: 7, letter: 'C' }, { row: 8, col: 8, letter: 'A' }]), { error: 'Place your tiles in one row or one column' });
  assert.deepEqual(play([{ row: 7, col: 7, letter: 'C' }, { row: 7, col: 9, letter: 'A' }]), { error: 'Your tiles must form one unbroken line' });
  assert.deepEqual(play([{ row: 7, col: 7, letter: 'C' }, { row: 7, col: 7, letter: 'A' }]), { error: 'Place one tile per square' });
  assert.ok('state' in play(spell('CAT', 5, 7, true)));

  const later = game({ 1: 'CATXYZE', 2: 'AAAAAAA' }, CAT);
  assert.deepEqual(move(later, 1, { type: 'play', tiles: spell('X', CENTER, CENTER) }), { error: 'Place tiles on empty squares' });
});

test('later words must connect to the board', () => {
  const state = game({ 1: 'ATXYZEE', 2: 'AAAAAAA' }, CAT);
  assert.deepEqual(move(state, 1, { type: 'play', tiles: spell('AT', 0, 0) }), { error: 'Your word must connect to tiles on the board' });
});

test('a word may run through tiles already on the board', () => {
  const board = game({ 1: 'B', 2: 'A' }, CAT).board;
  assert.equal(points(board, [{ row: 7, col: 5, letter: 'B' }, { row: 7, col: 9, letter: 'S' }]), 9);
});

test('premium squares count only under new tiles', () => {
  const board = game({ 1: 'S', 2: 'A' }, CAT).board;
  // CATS: the center double word was used by CAT and does not count again
  assert.equal(points(board, [{ row: 7, col: 9, letter: 'S' }]), 6);
});

test('every crossing word is scored', () => {
  const board = game({ 1: 'AT', 2: 'A' }, CAT).board;
  const result = evaluatePlacement(board, spell('AT', 8, 6));
  // AT with A on a double letter (3), CA (5) and AT (2)
  assert.deepEqual(result, {
    state: { words: [{ word: 'AT', points: 3 }, { word: 'CA', points: 5 }, { word: 'AT', points: 2 }], bingo: false, points: 10 }
  });
});

test('a single tile can make a word down the board', () => {
  const board = game({ 1: 'S', 2: 'A' }, CAT).board;
  const result = evaluatePlacement(board, [{ row: 8, col: 8, letter: 'O' }]);
  // TO, with the O on a double letter
  assert.deepEqual(result, { state: { words: [{ word: 'TO', points: 3 }], bingo: false, points: 3 } });
});

test('a blank stands for the chosen letter and is worth nothing', () => {
  const tiles: Placement[] = [{ row: 7, col: 7, letter: 'Q', blank: true }, { row: 7, col: 8, letter: 'I' }];
  const state = ok(move(game({ 1: `${BLANK}IAAAAA`, 2: 'AAAAAAA' }), 1, { type: 'play', tiles }));
  assert.equal(state.scores[1], 2);
  assert.deepEqual(state.board[7][7], { letter: 'Q', blank: true });
  assert.deepEqual(move(game({ 1: 'QIAAAAA', 2: 'AAAAAAA' }), 1, { type: 'play', tiles }), { error: 'You do not have those tiles' });
});

test('using all seven tiles earns the bingo bonus', () => {
  const state = ok(move(game({ 1: 'RETAINS', 2: 'AAAAAAA' }), 1, { type: 'play', tiles: spell('RETAINS', CENTER, 5) }));
  // 7 letters worth 1, the S on a double letter, the center double word, then 50
  assert.equal(state.scores[1], (8 * 2) + 50);
  assert.equal(state.gameStatus, 'A played RETAINS for 66 points (bingo!)');
});

test('playing tiles you do not hold is refused', () => {
  const state = game({ 1: 'CAXXXXX', 2: 'AAAAAAA' });
  assert.deepEqual(move(state, 1, { type: 'play', tiles: CAT }), { error: 'You do not have those tiles' });
});

test('an exchange swaps tiles with the bag', () => {
  const state = ok(move(game({ 1: 'QQZZXXA', 2: 'AAAAAAA' }), 1, { type: 'exchange', letters: ['Q', 'Q'] }));
  assert.deepEqual(state.racks[1], ['Z', 'Z', 'X', 'X', 'A', 'A', 'A']);
  assert.equal(state.bag.length, 100);
  assert.deepEqual(state.bag.slice(-2), ['Q', 'Q']);
  assert.equal(state.scorelessTurns, 1);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.gameStatus, 'A exchanged 2 tiles');
});

test('an exchange needs seven tiles in the bag and tiles you hold', () => {
  const low = game({ 1: 'QQZZXXA', 2: 'AAAAAAA' }, [], fullBag().slice(0, 6));
  assert.deepEqual(move(low, 1, { type: 'exchange', letters: ['Q'] }), { error: 'You can exchange only while the bag has at least 7 tiles' });
  assert.deepEqual(move(game({ 1: 'QQZZXXA', 2: 'AAAAAAA' }), 1, { type: 'exchange', letters: ['E'] }), { error: 'You do not have those tiles' });
});

test('after six scoreless turns in a row play goes on until a player ends the game, each losing their rack', () => {
  let state = game({ 1: 'QAAAAAA', 2: 'ZEEEEEE' });
  for (let turn = 0; turn < 5; turn++) state = ok(move(state, state.currentPlayer ?? 0, { type: 'pass' }));
  assert.equal(state.gameStatus, 'A passed');
  assert.deepEqual(scrabble.applyAction?.(state, 1, { type: 'endGame' }, first, 0), {
    error: 'The game can end only after 6 scoreless turns in a row'
  });

  state = ok(move(state, 2, { type: 'pass' }));
  assert.equal(state.isGameOver, false);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.gameStatus, 'B passed. 6 scoreless turns in a row: any player may end the game.');
  const seventh = ok(move(state, 1, { type: 'pass' }));
  assert.equal(seventh.isGameOver, false);
  assert.equal(seventh.scorelessTurns, 7);

  // Either player may end it, not only the one whose turn it is
  const ended = ok(scrabble.applyAction?.(seventh, 1, { type: 'endGame' }, first, 0) ?? { error: 'no actions' });
  assert.equal(ended.isGameOver, true);
  assert.equal(ended.currentPlayer, null);
  assert.deepEqual(ended.scores, { 1: -16, 2: -16 });
  assert.deepEqual(ended.endAdjustments, { 1: -16, 2: -16 });
  assert.deepEqual(ended.winners, [1, 2]);
  assert.equal(ended.gameStatus, 'A ended the game. A and B share the win with -16 points!');
  assert.deepEqual(scrabble.applyAction?.(ended, 2, { type: 'endGame' }, first, 0), {
    error: 'The game can end only after 6 scoreless turns in a row'
  });
  assert.deepEqual(scrabble.applyAction?.({ ...seventh, undoVote: { requestedBy: 2, votes: {} } }, 1, { type: 'endGame' }, first, 0), {
    error: 'An undo vote is in progress'
  });
  assert.deepEqual(scrabble.applyAction?.(seventh, 1, { type: 'resign' }, first, 0), { error: 'Unknown action' });

  // A scoring play starts the count again
  const scored = ok(move({ ...game({ 1: 'CATAAAA', 2: 'AAAAAAA' }), scorelessTurns: 7 }, 1, { type: 'play', tiles: CAT }));
  assert.equal(scored.scorelessTurns, 0);
  assert.equal(scored.gameStatus, 'A played CAT for 10 points');
});

// Returns the given numbers in turn, then 0
function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0;
}

// Bo joins Ann, drawing for first with `random`
function boJoinsAnn(random: () => number): GameState {
  const result = addPlayer(scrabble, lobby('Ann'), 'Bo', random);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

test('the tile drawn closest to A goes first, and the tiles go back before the deal', () => {
  // The bag starts A x9, B x2, C x2, D x4, E x12: Ann draws an E, then Bo a B
  const state = boJoinsAnn(sequence(17.5 / 100, 9.5 / 99));
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.gameStatus, 'Bo joined (2/4 players). Ann drew E, Bo drew B. Bo goes first.');
  assert.equal(state.bag.length, 86);
});

test('a blank beats every letter in the draw for first', () => {
  // Ann draws the Z, the last letter before the two blanks; Bo draws a blank
  const state = boJoinsAnn(sequence(97.5 / 100, 97.5 / 99));
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.gameStatus, 'Bo joined (2/4 players). Ann drew Z, Bo drew a blank. Bo goes first.');
});

test('tied players draw again for first, and only they do', () => {
  // Drawing the first tile left every time: three rounds of A, then Ann and Bo tie on B against Cy's C
  const state = lobby('Ann', 'Bo', 'Cy');
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.gameStatus, 'Cy joined (3/4 players). ' + [
    'Ann drew A, Bo drew A, Cy drew A',
    'Ann drew A, Bo drew A, Cy drew A',
    'Ann drew A, Bo drew A, Cy drew A',
    'Ann drew B, Bo drew B, Cy drew C',
    'Ann drew C, Bo drew D'
  ].join('; tie, so they draw again: ') + '. Ann goes first.');
  assert.deepEqual(Object.values(state.racks).map(rack => rack.length), [7, 7, 7]);
  assert.equal(state.bag.length, 79);
});

test('going out with the bag empty ends the game and takes the other racks', () => {
  const state = ok(move(game({ 1: 'CAT', 2: 'QZ' }, [], []), 1, { type: 'play', tiles: CAT }));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.endAdjustments, { 1: 20, 2: -20 });
  assert.deepEqual(state.scores, { 1: 30, 2: -20 });
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.gameStatus, 'A wins with 30 points!');
});

test('a player who leaves mid-game returns their tiles to the bag', () => {
  let state = ok(move(game({ 1: 'CATAAAA', 2: 'AAAAAAA' }), 1, { type: 'play', tiles: CAT }));
  state = { ...state, ...addPlayerRack(state, 3, 'QZXJKEE') };
  const left = removePlayer(scrabble, state, 3, first);
  assert.equal(left.bag.length, state.bag.length + 7);
  assert.equal(3 in left.racks, false);
  assert.equal(left.scores[1], 10);
});

function addPlayerRack(state: GameState, seat: Seat, letters: string): Partial<GameState> {
  return {
    activePlayers: [...state.activePlayers, seat],
    playerNames: { ...state.playerNames, [seat]: 'C' },
    racks: { ...state.racks, [seat]: letters.split('') },
    scores: { ...state.scores, [seat]: 0 }
  };
}

test('each view holds only its own rack, and the bag only as a count', () => {
  const state = game({ 1: 'CATAAAA', 2: 'QZXJKEE' });
  const mine = toPublicState(state, false, 1);
  assert.deepEqual(mine.rack, 'CATAAAA'.split(''));
  assert.deepEqual(toPublicState(state, false, 2).rack, 'QZXJKEE'.split(''));
  assert.deepEqual(toPublicState(state, false, null).rack, []);
  assert.deepEqual(mine.rackCounts, { 1: 7, 2: 7 });
  assert.equal(mine.bagCount, 100);
  assert.equal('racks' in mine, false);
  assert.equal('bag' in mine, false);
});

test('malformed moves are refused', () => {
  const state = game({ 1: 'CATAAAA', 2: 'AAAAAAA' });
  const bad: unknown[] = [
    null, {}, { type: 'play' }, { type: 'play', tiles: [{ row: 7, col: 7, letter: 'c' }] },
    { type: 'play', tiles: [{ row: 15, col: 7, letter: 'C' }] }, { type: 'play', tiles: [{ row: 7.5, col: 7, letter: 'C' }] },
    { type: 'play', tiles: [{ row: 7, col: 7, letter: 'C', blank: 'yes' }] }, { type: 'exchange', letters: [] },
    { type: 'exchange', letters: ['1'] }
  ];
  for (const input of bad) assert.deepEqual(applyMove(scrabble, state, 1, input, first), { error: 'Invalid move' });
  assert.deepEqual(move(state, 1, { type: 'play', tiles: [] }), { error: 'Place at least one tile' });
});

// Turn timer

const T0 = 1_000_000;
const MINUTE = 60_000;
const timed = (minutes: 'off' | 1 | 2 | 3 | 5 = 2): GameState => ({
  ...game({ 1: 'CATAAAA', 2: 'AAAAAAA' }),
  started: true,
  houseRules: withRules({ turnMinutes: minutes })
});

test('with the timer off there is no deadline', () => {
  const state = scrabble.resumeClock?.(timed('off'), T0) as GameState;
  assert.equal(state.turnLimitStartedAt, null);
  assert.equal(scrabble.deadline?.(state), null);
  assert.equal(scrabble.deadline?.(scrabble.createGameState('g1')), null);
});

test('the turn passes when the timer runs out', () => {
  const started = scrabble.resumeClock?.(timed(), T0) as GameState;
  assert.equal(scrabble.deadline?.(started), T0 + 2 * MINUTE);
  const passed = scrabble.onDeadline?.(started, T0 + 2 * MINUTE, first) as GameState;
  assert.equal(passed.currentPlayer, 2);
  assert.deepEqual(passed.lastMove, { type: 'pass', playerNumber: 1, timedOut: true });
  assert.equal(passed.gameStatus, 'A ran out of time');
  assert.deepEqual(passed.racks, started.racks);
});

test('a timed-out turn counts as scoreless', () => {
  let state = { ...(scrabble.resumeClock?.(timed(1), T0) as GameState), scorelessTurns: 5 };
  state = scrabble.onDeadline?.(state, T0 + MINUTE, first) as GameState;
  assert.equal(state.scorelessTurns, 6);
  assert.match(state.gameStatus, /any player may end the game/);
});

test('each turn gets the full time', () => {
  const started = scrabble.resumeClock?.(timed(), T0) as GameState;
  const next = ok(applyMove(scrabble, started, 1, { type: 'pass' }, first, T0 + 90_000));
  assert.equal(next.turnLimitStartedAt, T0 + 90_000);
  assert.equal(scrabble.deadline?.(next), T0 + 90_000 + 2 * MINUTE);
  const late = ok(applyMove(scrabble, started, 1, { type: 'pass' }, first, T0 + 3 * MINUTE));
  assert.equal(late.lastMove?.type === 'pass' && late.lastMove.timedOut, true); // a move that arrives late is a timeout
  const loaded = scrabble.resumeClock?.(next, T0 + 9_999_999) as GameState;
  assert.equal(scrabble.deadline?.(loaded), T0 + 9_999_999 + 2 * MINUTE); // downtime is not charged
  assert.equal(scrabble.deadline?.(scrabble.resetLobby(loaded, first)), null);
});

test('finalStandings ranks by the highest score', () => {
  const state: GameState = {
    ...createGameState('t'), activePlayers: [1, 2, 3], isGameOver: true, winners: [1], scores: { 1: 310, 2: 188, 3: 188 }
  };
  assert.deepEqual(finalStandings(state), [
    { seat: 1, place: 1, score: '310 points' },
    { seat: 2, place: 2, score: '188 points' }, { seat: 3, place: 2, score: '188 points' }
  ]);
});
