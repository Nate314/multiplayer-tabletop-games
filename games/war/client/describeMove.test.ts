import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove, Outcome } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });
const flip = (playerNumber: number, outcome: Outcome, rest: Partial<LastMove> = {}): LastMove => ({
  type: 'flip', playerNumber, war: false, down: 0, up: { rank: 'Q', suit: 'hearts' }, fresh: true, outcome, ...rest
});

test('describes a flip that waits for the other player', () => {
  assert.equal(describe(flip(1, { kind: 'waiting' })), 'Alice turned up the queen of hearts');
});

test('describes who won a battle or a war and how many cards they took', () => {
  assert.equal(describe(flip(2, { kind: 'won', winner: 2, taken: 2 })), 'Bob turned up the queen of hearts and wins the battle, taking 2 cards');
  assert.equal(describe(flip(2, { kind: 'won', winner: 1, taken: 2 })), 'Bob turned up the queen of hearts and Alice wins the battle, taking 2 cards');
  assert.equal(describe(flip(1, { kind: 'won', winner: 1, taken: 6 }, { war: true, down: 1 })),
    'Alice put a card face down and turned up the queen of hearts and wins the war, taking 6 cards');
});

test('describes a tie, a last card and a card that stands', () => {
  assert.equal(describe(flip(2, { kind: 'war' })), 'Bob turned up the queen of hearts: a tie, so it is war!');
  assert.equal(describe(flip(2, { kind: 'waiting' }, { war: true })), 'Bob turned up the last card in the pile, the queen of hearts');
  assert.equal(describe(flip(2, { kind: 'waiting' }, { war: true, fresh: false })), 'Bob has no cards left, so the queen of hearts stands');
  assert.equal(describe(flip(1, { kind: 'returned' }, { war: true })),
    'Alice turned up the last card in the pile, the queen of hearts: a tie, and both players are out of cards, so each takes their own cards back');
});

test('describes nothing before the first flip', () => {
  assert.equal(describe(null), '');
});
