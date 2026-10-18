import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEX_VERTICES } from '../board.ts';
import { describeMove } from './describeMove.ts';
import { dice, game, holding, played } from '../testing.ts';

test('describes a roll and what it produced', () => {
  const state = played(game({ buildings: { [HEX_VERTICES[0][0]]: { seat: 2, city: false } } }), 1, { type: 'roll' }, dice(1, 1));
  assert.equal(describeMove(state), 'Alice rolled 1 and 1. Bob took 1 wood');
});

test('names a bought card or a stolen card to nobody', () => {
  const bought = played(holding(game({ rolled: true }), 1, { sheep: 1, wheat: 1, ore: 1 }), 1, { type: 'buyDevCard' });
  assert.equal(describeMove(bought), 'Alice bought a development card');
  const robbing = holding(game({ rolled: true, pending: { kind: 'robber' }, buildings: { [HEX_VERTICES[4][0]]: { seat: 2, city: false } } }), 2, { ore: 1 });
  assert.equal(describeMove(played(robbing, 1, { type: 'moveRobber', hex: 4, victim: 2 })), 'Alice moved the robber. Alice stole a card from Bob');
});

test('a state without a move has no description', () => {
  assert.equal(describeMove({ lastMove: null }), '');
});
