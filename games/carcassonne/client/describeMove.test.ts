import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };

test('describes placing a tile', () => {
  const lastMove = { type: 'place', playerNumber: 1, tile: 'V', x: 1, y: 0, rotation: 2 } as const;
  assert.equal(describeMove({ lastMove, playerNames }), 'Alice placed a curved road');
});

test('describes a meeple, what scored and any tile that fit nowhere', () => {
  const lastMove = {
    type: 'meeple', playerNumber: 2, feature: { kind: 'city', index: 0 }, discarded: ['C'],
    scored: [{ kind: 'city', complete: true, tiles: 2, points: 4, seats: [1, 2], meeples: [1, 2] }]
  } as const;
  assert.equal(describeMove({ lastMove, playerNames }),
    'Bob put a meeple on a city, Alice and Bob scored 4 for a city, a tile fit nowhere and left the game');
});

test('describes placing no meeple', () => {
  const lastMove = { type: 'meeple', playerNumber: 1, feature: null, scored: [], discarded: [] } as const;
  assert.equal(describeMove({ lastMove, playerNames }), 'Alice placed no meeple');
});

test('describes nothing before the first move', () => {
  assert.equal(describeMove({ lastMove: null, playerNames }), '');
});
