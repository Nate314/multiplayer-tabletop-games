import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });

test('describes plays from each source, Skip-Bo cards and completed piles', () => {
  assert.equal(
    describe({ playerNumber: 1, type: 'play', from: { kind: 'stock' }, to: 0, card: { id: 3, kind: 'number', value: 4 }, value: 4, completed: false }),
    'Alice played a 4 from their stock on building pile 1'
  );
  assert.equal(
    describe({ playerNumber: 2, type: 'play', from: { kind: 'hand', index: 2 }, to: 3, card: { id: 150, kind: 'skipbo' }, value: 8, completed: false }),
    'Bob played a Skip-Bo as 8 from their hand on building pile 4'
  );
  assert.equal(
    describe({ playerNumber: 1, type: 'play', from: { kind: 'discard', pile: 1 }, to: 1, card: { id: 11, kind: 'number', value: 12 }, value: 12, completed: true }),
    'Alice played a 12 from a discard pile on building pile 2 and completed building pile 2'
  );
});

test('describes discards and ending a turn with no cards', () => {
  assert.equal(describe({ playerNumber: 2, type: 'discard', card: { id: 7, kind: 'number', value: 8 }, pile: 2 }), 'Bob discarded an 8 on discard pile 3');
  assert.equal(describe({ playerNumber: 2, type: 'discard', card: { id: 10, kind: 'number', value: 11 }, pile: 3 }), 'Bob discarded an 11 on discard pile 4');
  assert.equal(describe({ playerNumber: 1, type: 'discard', card: { id: 151, kind: 'skipbo' }, pile: 0 }), 'Alice discarded a Skip-Bo on discard pile 1');
  assert.equal(describe({ playerNumber: 1, type: 'endTurn' }), 'Alice had no cards to discard and ended their turn');
  assert.equal(describe(null), '');
});
