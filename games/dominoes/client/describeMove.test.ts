import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });

test('describes the first tile, a tile on an end and going out', () => {
  assert.equal(describe({ type: 'play', playerNumber: 1, tile: 27, pips: [6, 6], end: null, wentOut: false }), 'Alice played 6-6');
  assert.equal(describe({ type: 'play', playerNumber: 2, tile: 5, pips: [2, 6], end: 'left', wentOut: false }),
    'Bob played 2-6 on the left');
  assert.equal(describe({ type: 'play', playerNumber: 1, tile: 5, pips: [6, 2], end: 'right', wentOut: true }),
    'Alice played 6-2 on the right and went out');
});

test('describes draws and passes, and nothing for no move', () => {
  assert.equal(describe({ type: 'draw', playerNumber: 2 }), 'Bob drew a tile');
  assert.equal(describe({ type: 'pass', playerNumber: 1 }), 'Alice passed');
  assert.equal(describe(null), '');
});
