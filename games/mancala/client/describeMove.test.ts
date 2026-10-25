import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes a single lap with the pit numbered from the mover\'s left', () => {
  const lastMove = { playerNumber: 2, pit: 9, end: 1, pickedUp: 4, laps: 1, extraTurn: false };
  assert.equal(describeMove({ lastMove, playerNames }), 'Bob picked up 4 stones from pit 3, ending in an empty pit');
});

test('describes a chain ending in the bank for an extra turn', () => {
  const lastMove = { playerNumber: 1, pit: 2, end: 6, pickedUp: 4, laps: 2, extraTurn: true };
  assert.equal(
    describeMove({ lastMove, playerNames }),
    'Alice picked up 4 stones from pit 3 and kept going once, ending in Alice\'s bank for an extra turn'
  );
});

test('describes a longer chain', () => {
  const lastMove = { playerNumber: 1, pit: 0, end: 9, pickedUp: 1, laps: 4, extraTurn: false };
  assert.equal(
    describeMove({ lastMove, playerNames }),
    'Alice picked up 1 stone from pit 1 and kept going 3 times, ending in an empty pit'
  );
});

test('a last stone in the bank that ends the game gives no extra turn', () => {
  const lastMove = { playerNumber: 2, pit: 12, end: 13, pickedUp: 1, laps: 1, extraTurn: false };
  assert.equal(describeMove({ lastMove, playerNames }), 'Bob picked up 1 stone from pit 6, ending in Bob\'s bank');
});

test('describes nothing before the first move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames }), '');
});

test('names the opponent\'s pit when the mover played from the other side', () => {
  const lastMove = { playerNumber: 1, pit: 9, end: 3, pickedUp: 4, laps: 1, extraTurn: false, fromOpponent: true as const };
  assert.equal(describeMove({ lastMove, playerNames }), 'Alice picked up 4 stones from Bob\'s pit 3, ending in an empty pit');
});

test('describes a Kalah capture and a Kalah ending in a pit with stones', () => {
  const capture = { playerNumber: 1, pit: 0, end: 1, pickedUp: 1, laps: 1, extraTurn: false, captured: 5 };
  assert.equal(describeMove({ lastMove: capture, playerNames }), 'Alice picked up 1 stone from pit 1, ending in an empty pit and capturing 5 stones');
  const stones = { playerNumber: 2, pit: 7, end: 9, pickedUp: 2, laps: 1, extraTurn: false, endedOnStones: true as const };
  assert.equal(describeMove({ lastMove: stones, playerNames }), 'Bob picked up 2 stones from pit 1, ending in a pit with stones');
});
