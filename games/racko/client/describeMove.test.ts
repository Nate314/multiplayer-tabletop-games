import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });

test('describes draws from each pile, naming only the discard', () => {
  assert.equal(describe({ playerNumber: 1, type: 'draw', from: 'discard', card: 23 }), 'Alice took the 23 from the discard pile');
  assert.equal(describe({ playerNumber: 2, type: 'draw', from: 'deck', reshuffled: false }), 'Bob drew from the draw pile');
  assert.equal(
    describe({ playerNumber: 2, type: 'draw', from: 'deck', reshuffled: true }),
    'Bob drew from the draw pile (the discards were reshuffled into it)'
  );
});

test('describes placing, discarding and calling Rack-O', () => {
  assert.equal(
    describe({ playerNumber: 1, type: 'place', slot: 0, from: 'discard', replaced: 31, rackO: false }),
    'Alice put the card from the discard pile in slot 1 and discarded the 31'
  );
  assert.equal(
    describe({ playerNumber: 2, type: 'place', slot: 9, from: 'deck', replaced: 4, rackO: true }),
    'Bob put the card from the draw pile in slot 10 and discarded the 4, calling Rack-O!'
  );
  assert.equal(describe({ playerNumber: 1, type: 'discard', card: 40 }), 'Alice discarded the 40');
  assert.equal(describe(null), '');
});
