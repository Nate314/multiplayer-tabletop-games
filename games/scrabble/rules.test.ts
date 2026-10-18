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

test('six scoreless turns in a row end the game, each losing their rack', () => {
  let state = game({ 1: 'QAAAAAA', 2: 'ZEEEEEE' });
  for (let turn = 0; turn < 5; turn++) state = ok(move(state, state.currentPlayer ?? 0, { type: 'pass' }));
  assert.equal(state.isGameOver, false);
  assert.equal(state.gameStatus, 'A passed');
  state = ok(move(state, 2, { type: 'pass' }));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.scores, { 1: -16, 2: -16 });
  assert.deepEqual(state.endAdjustments, { 1: -16, 2: -16 });
  assert.deepEqual(state.winners, [1, 2]);
  assert.equal(state.gameStatus, 'A and B share the win with -16 points!');
});

test('a scoring play resets the scoreless count', () => {
  const state = ok(move({ ...game({ 1: 'CATAAAA', 2: 'AAAAAAA' }), scorelessTurns: 5 }, 1, { type: 'play', tiles: CAT }));
  assert.equal(state.scorelessTurns, 0);
  assert.equal(state.isGameOver, false);
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
