import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import type { LastMove } from '../types.ts';

const playerNames = { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' };
const describe = (lastMove: LastMove | null) => describeMove({ lastMove, playerNames });

test('describes taking and handing out tasks', () => {
  assert.equal(describe({ type: 'takeTask', playerNumber: 1, card: { suit: 'blue', value: 4 }, token: null }), 'Alice took the task blue 4');
  assert.equal(describe({ type: 'takeTask', playerNumber: 1, card: { suit: 'blue', value: 4 }, token: '>>' }), 'Alice took the task blue 4, order token >>');
  assert.equal(describe({ type: 'assignTask', playerNumber: 1, seat: 3, card: { suit: 'green', value: 2 } }), 'Alice gave Cara the task green 2');
  assert.equal(describe({ type: 'handOverTask', playerNumber: 1, from: 2, to: 4, card: { suit: 'pink', value: 6 } }), 'Bob handed the task pink 6 to Dan');
  assert.equal(describe({ type: 'moveToken', playerNumber: 1, from: { suit: 'pink', value: 6 }, to: { suit: 'blue', value: 1 }, swap: true }),
    'Alice swapped the order tokens of pink 6 and blue 1');
  assert.equal(describe({ type: 'moveToken', playerNumber: 1, from: { suit: 'pink', value: 6 }, to: { suit: 'blue', value: 1 }, swap: false }),
    'Alice moved the order token from pink 6 to blue 1');
});

test('describes the commander\'s picks and the distress signal', () => {
  assert.equal(describe({ type: 'choosePlayer', playerNumber: 1, seat: 2, role: 'sick' }), 'Alice chose Bob as the sick crew member, who must not win a trick');
  assert.equal(describe({ type: 'choosePlayer', playerNumber: 1, seat: 2, role: 'mute' }), 'Alice chose Bob, who may not communicate in this mission');
  assert.equal(describe({ type: 'choosePlayer', playerNumber: 1, seat: 2, role: 'takesAll' }), 'Alice chose Bob to take all the tasks');
  assert.equal(describe({ type: 'choosePlayer', playerNumber: 1, seat: 2, role: 'relayFirst' }), 'Alice chose Bob to win tricks 1 to 4');
  assert.equal(describe({ type: 'distress', playerNumber: 1, direction: 'right' }), 'Alice sent a distress signal: everyone passes a card to the right');
});

test('describes plays, who won the trick and how the mission ended', () => {
  assert.equal(describe({ type: 'play', playerNumber: 4, card: { suit: 'rocket', value: 4 }, trickWinner: 4, result: 'success' }),
    'Dan played rocket 4 and won the trick. Mission complete!');
  assert.equal(describe({ type: 'play', playerNumber: 1, card: { suit: 'yellow', value: 9 }, trickWinner: null, result: null }), 'Alice played yellow 9');
});

test('nothing before the first move', () => {
  assert.equal(describe(null), '');
});
