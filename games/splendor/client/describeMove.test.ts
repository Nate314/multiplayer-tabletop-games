import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import { emptyTokens } from '../rules.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const say = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });

test('nothing to describe before the first move', () => {
  assert.equal(say(null), '');
});

test('describes taking gems', () => {
  assert.equal(say({ seat: 1, noble: null, type: 'takeThree', colors: ['white', 'blue', 'red'] }), 'Alice took white, blue, red');
  assert.equal(say({ seat: 2, noble: null, type: 'takeTwo', color: 'green' }), 'Bob took 2 green');
});

test('a card reserved from a deck is not named', () => {
  assert.equal(say({ seat: 1, noble: null, type: 'reserve', level: 3, card: null, gold: true }), 'Alice reserved the top level 3 card and took a gold');
  assert.equal(say({ seat: 1, noble: null, type: 'reserve', level: 1, card: 0, gold: false }), 'Alice reserved a level 1 white card');
});

test('describes a purchase with its payment and a noble visit', () => {
  const paid = { ...emptyTokens(), red: 2, gold: 1 };
  assert.equal(
    say({ seat: 2, noble: 4, type: 'buy', card: 89, fromReserve: true, paid }),
    'Bob bought a level 3 black card from their reserve for 2 red, 1 gold, and a noble visited'
  );
});

test('a purchase paid entirely by bonuses is free', () => {
  assert.equal(say({ seat: 1, noble: null, type: 'buy', card: 0, fromReserve: false, paid: emptyTokens() }), 'Alice bought a level 1 white card for free');
});

test('describes returning tokens, choosing a noble and passing', () => {
  assert.equal(say({ seat: 1, noble: null, type: 'returnTokens', tokens: { ...emptyTokens(), blue: 1 } }), 'Alice returned 1 blue');
  assert.equal(say({ seat: 1, noble: 3, type: 'chooseNoble' }), 'Alice chose a noble to visit');
  assert.equal(say({ seat: 2, noble: null, type: 'pass' }), 'Bob could not act and passed');
});
