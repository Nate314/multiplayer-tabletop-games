import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import { played, dice, game } from '../testing.ts';

test('describes a roll and everything it led to', () => {
  const state = played(game({ owners: { 3: 2 } }), 1, { type: 'roll' }, dice(1, 2));
  assert.equal(describeMove(state), 'Alice rolled 1 and 2. Alice moved to Baltic Avenue. Alice paid Bob $4 (rent for Baltic Avenue)');
});

test('describes buying and ending a turn', () => {
  const landed = played(game(), 1, { type: 'roll' }, dice(2, 4));
  const bought = played(landed, 1, { type: 'buy' });
  assert.equal(describeMove(bought), 'Alice bought Oriental Avenue for $100');
  assert.equal(describeMove(played(bought, 1, { type: 'endTurn' })), 'Alice ended their turn');
});

test('a state without a move has no description', () => {
  assert.equal(describeMove({ lastMove: null }), '');
});
