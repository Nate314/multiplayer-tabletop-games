import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMove } from './describeMove.ts';
import { dice, game, played } from '../testing.ts';

test('describes an attack and its capture', () => {
  const state = game({ phase: 'attack', reinforcements: 0, armies: { ...game().armies, redwater: 5, mossdeep: 1 } });
  const won = played(state, 1, { type: 'attack', from: 'redwater', to: 'mossdeep', dice: 3 }, dice(6, 2, 1, 5));
  assert.equal(describeMove(won),
    'Alice attacked Mossdeep (Cara) from Redwater, rolled 6, 2, 1 against 5: the attacker lost 0, the defender 1. Alice captured Mossdeep');
});

test('describes placing armies and ending a turn without naming a drawn card', () => {
  const placed = played(game(), 1, { type: 'place', placements: { redwater: 3 } });
  assert.equal(describeMove(placed), 'Alice placed 3 on Redwater');
  const ended = played({ ...placed, conqueredThisTurn: true }, 1, { type: 'endTurn' });
  assert.equal(describeMove(ended), 'Alice drew a card. Alice ended their turn. Bob receives 4 armies');
});

test('a state without a move has no description', () => {
  assert.equal(describeMove({ lastMove: null }), '');
});
