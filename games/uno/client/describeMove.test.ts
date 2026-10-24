import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { Card, LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });
const FOUR: Card = { color: 'wild', value: 'wildDrawFour' };

test('describes a plain play and a Wild with its color', () => {
  assert.equal(describe({
    type: 'play', playerNumber: 1, card: { color: 'red', value: '7' }, color: 'red', target: null, drew: 0, wentOut: false
  }), 'Alice played red 7');
  assert.equal(describe({
    type: 'play', playerNumber: 2, card: { color: 'wild', value: 'wild' }, color: 'green', target: null, drew: 0, wentOut: false
  }), 'Bob played Wild (green)');
});

test('describes who a card skipped and what they drew', () => {
  assert.equal(describe({
    type: 'play', playerNumber: 1, card: { color: 'blue', value: 'skip' }, color: 'blue', target: 2, drew: 0, wentOut: false
  }), 'Alice played blue Skip; Bob is skipped');
  assert.equal(describe({
    type: 'play', playerNumber: 1, card: { color: 'blue', value: 'drawTwo' }, color: 'blue', target: 2, drew: 2, wentOut: false
  }), 'Alice played blue Draw Two; Bob draws 2 and is skipped');
});

test('describes a Wild Draw Four and how it was answered', () => {
  assert.equal(describe({ type: 'play', playerNumber: 1, card: FOUR, color: 'red', target: 2, drew: 0, wentOut: false }),
    'Alice played Wild Draw Four (red); Bob may accept or challenge it');
  assert.equal(describe({ type: 'accept', playerNumber: 2, drew: 4 }), 'Bob accepted the Wild Draw Four, draws 4 and is skipped');
  assert.equal(describe({ type: 'challenge', playerNumber: 2, challenged: 1, guilty: true, drew: 4 }),
    'Bob challenged Alice\'s Wild Draw Four and won; Alice draws 4');
  assert.equal(describe({ type: 'challenge', playerNumber: 2, challenged: 1, guilty: false, drew: 6 }),
    'Bob challenged Alice\'s Wild Draw Four and lost; Bob draws 6 and is skipped');
});

test('describes going out, with what the next player drew', () => {
  assert.equal(describe({
    type: 'play', playerNumber: 1, card: { color: 'red', value: '7' }, color: 'red', target: null, drew: 0, wentOut: true
  }), 'Alice played red 7 and went out');
  assert.equal(describe({ type: 'play', playerNumber: 1, card: FOUR, color: 'red', target: 2, drew: 4, wentOut: true }),
    'Alice played Wild Draw Four (red) and went out; Bob draws 4');
});

test('describes draws, passes and the first color', () => {
  assert.equal(describe({ type: 'draw', playerNumber: 2, passed: false }), 'Bob drew a card');
  assert.equal(describe({ type: 'draw', playerNumber: 2, passed: true }), 'Bob drew a card and could not play it');
  assert.equal(describe({ type: 'pass', playerNumber: 1 }), 'Alice passed');
  assert.equal(describe({ type: 'chooseColor', playerNumber: 1, color: 'blue' }), 'Alice chose blue to start');
  assert.equal(describe(null), '');
});

test('describes stacks, swaps and long draws', () => {
  const two = { color: 'red', value: 'drawTwo' } as const;
  assert.equal(describe({ type: 'play', playerNumber: 1, card: two, color: 'red', target: 2, drew: 0, wentOut: false, stack: 4 }),
    'Alice played red Draw Two; Bob must stack or draw 4');
  assert.equal(describe({ type: 'play', playerNumber: 1, card: FOUR, color: 'red', target: 2, drew: 0, wentOut: false, stack: 4 }),
    'Alice played Wild Draw Four (red); Bob may stack it, accept or challenge it');
  assert.equal(describe({ type: 'accept', playerNumber: 2, drew: 6, stacked: true }), 'Bob accepted the stack, draws 6 and is skipped');
  assert.equal(describe({
    type: 'play', playerNumber: 1, card: { color: 'red', value: '7' }, color: 'red', target: null, drew: 0, wentOut: false, swappedWith: 2
  }), 'Alice played red 7; swaps hands with Bob');
  assert.equal(describe({
    type: 'play', playerNumber: 1, card: { color: 'red', value: '0' }, color: 'red', target: null, drew: 0, wentOut: false, passedHands: true
  }), 'Alice played red 0; every hand passes on');
  assert.equal(describe({ type: 'draw', playerNumber: 2, passed: false, count: 3 }), 'Bob drew 3 cards');
  assert.equal(describe({ type: 'draw', playerNumber: 2, passed: true, count: 3 }), 'Bob drew 3 cards and could not play any');
});
