import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes a roll with the rolls left', () => {
  assert.equal(describeMove({ lastMove: { type: 'roll', playerNumber: 1, dice: [1, 2, 3, 4, 5], rollsLeft: 2 }, playerNames }), 'Alice rolled 1 2 3 4 5, 2 rolls left');
  assert.equal(describeMove({ lastMove: { type: 'roll', playerNumber: 2, dice: [6, 6, 6, 6, 5], rollsLeft: 1 }, playerNames }), 'Bob rolled 6 6 6 6 5, 1 roll left');
});

test('describes a score, a scratch and a Yahtzee bonus', () => {
  const dice = [4, 4, 4, 4, 4];
  assert.equal(describeMove({ lastMove: { type: 'score', playerNumber: 1, category: 'yahtzee', points: 50, bonus: false, dice }, playerNames }), 'Alice scored 50 points in Yahtzee');
  assert.equal(describeMove({ lastMove: { type: 'score', playerNumber: 2, category: 'largeStraight', points: 0, bonus: false, dice }, playerNames }), 'Bob scored 0 points in Large straight');
  assert.equal(describeMove({ lastMove: { type: 'score', playerNumber: 2, category: 'fours', points: 20, bonus: true, dice }, playerNames }), 'Bob scored 20 points in Fours and a 100 point Yahtzee bonus');
});

test('describes nothing before the first move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames }), '');
});
