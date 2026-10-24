import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob', 3: 'Cara' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });

test('describes the first tile, a tile on an end and going out', () => {
  assert.equal(describe({ type: 'play', playerNumber: 1, tile: 27, pips: [6, 6], where: null, wentOut: false }), 'Alice played 6-6');
  assert.equal(describe({ type: 'play', playerNumber: 2, tile: 5, pips: [2, 6], where: 'on the left', wentOut: false }),
    'Bob played 2-6 on the left');
  assert.equal(describe({ type: 'play', playerNumber: 1, tile: 5, pips: [6, 2], where: 'on the right', wentOut: true }),
    'Alice played 6-2 on the right and went out');
});

test('describes a play on each kind of end', () => {
  const played = (playerNumber: number, pips: [number, number], where: string) =>
    describe({ type: 'play', playerNumber, tile: 0, pips, where, wentOut: false });
  assert.equal(played(2, [4, 6], 'on the first branch of 4-4'), 'Bob played 4-6 on the first branch of 4-4');
  assert.equal(played(3, [6, 1], "on Bob's train"), "Cara played 6-1 on Bob's train");
  assert.equal(played(1, [6, 2], 'on the Mexican train'), 'Alice played 6-2 on the Mexican train');
  assert.equal(played(1, [6, 5], 'on the top'), 'Alice played 6-5 on the top');
});

test('describes a play saved before layouts by its end', () => {
  const saved = { type: 'play', playerNumber: 2, tile: 5, pips: [2, 6], end: 'left', wentOut: false } as unknown as LastMove;
  assert.equal(describe(saved), 'Bob played 2-6 on the left');
});

test('describes draws and passes, and nothing for no move', () => {
  assert.equal(describe({ type: 'draw', playerNumber: 2 }), 'Bob drew a tile');
  assert.equal(describe({ type: 'pass', playerNumber: 1 }), 'Alice passed');
  assert.equal(describe(null), '');
});
