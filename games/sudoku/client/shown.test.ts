import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardOwner, boardSeats, lastCellOn, shownBoard } from './shown.ts';
import type { Board, PublicGameState } from '../types.ts';

const board = (first: number): Board => ({ entries: [first, ...Array(80).fill(0)], by: Array(81).fill(null) });

function race(boards: number[], lastMover: number | null = null, cell = 0): PublicGameState {
  return {
    houseRules: { values: { mode: 'race' } },
    board: board(0),
    raceBoards: Object.fromEntries(boards.map(seat => [seat, board(seat)])),
    lastMove: lastMover === null ? null : { type: 'enter', playerNumber: lastMover, cell, digit: 5 }
  } as unknown as PublicGameState;
}

test('a Race view lists the seats whose boards it holds, in seat order', () => {
  assert.deepEqual(boardSeats(race([3, 1, 2])), [1, 2, 3]);
  assert.deepEqual(boardSeats({ ...race([1, 2]), houseRules: { values: { mode: 'together' } } } as PublicGameState), []);
});

test('the board shown is the chosen one, else the viewer\'s, else the last mover\'s, else the first', () => {
  const state = race([1, 2, 3], 3);
  assert.equal(boardOwner(state, 1, 2), 2);
  assert.equal(boardOwner(state, 1, null), 1);
  assert.equal(boardOwner(state, null, null), 3);
  assert.equal(boardOwner(race([1, 2]), null, null), 1);
  assert.equal(boardOwner(state, null, 5), 3); // a pick no longer in view falls back
  assert.equal(boardOwner(race([]), null, null), null);
});

test('with no Race board in view only the givens show', () => {
  assert.equal(shownBoard(race([2]), 2).entries[0], 2);
  assert.equal(shownBoard(race([]), null).entries.every(digit => digit === 0), true);
});

test('in a Race the last move is outlined only on its own player\'s board', () => {
  const state = race([1, 2], 1, 7);
  assert.equal(lastCellOn(state, 1), 7);
  assert.equal(lastCellOn(state, 2), null);
  assert.equal(lastCellOn({ ...state, houseRules: { values: { mode: 'together' } } } as PublicGameState, null), 7);
});
